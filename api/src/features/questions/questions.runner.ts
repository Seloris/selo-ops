import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from "node:child_process";
import { z } from "zod";
import type { tokensSchema } from "../sessions/sessions.schema.js";

// `question` BR-01, BR-02: a headless Claude Code run that only reads, with no hook, skill nor MCP server, so that it is
// no selo session (the selo plugins' hooks never see it) and leaves the project as it found it.

export const QUESTION_MODEL = "sonnet";
const READ_TOOLS = "Read,Grep,Glob";

export type RunErrorCode = "missing-binary" | "run-failed";

export class RunError extends Error {
  constructor(
    readonly code: RunErrorCode,
    readonly detail: string | null,
  ) {
    super(detail ?? code);
    this.name = "RunError";
  }
}

export interface RunInput {
  // The checkout the run reads.
  cwd: string;
  prompt: string;
  // A UUID given by Selo Ops: the run's Claude Code session id.
  sessionId: string;
  // Aborted on a timeout or a deletion: the run is stopped.
  signal: AbortSignal;
}

export type Tokens = z.infer<typeof tokensSchema>;

export interface RunResult {
  answer: string;
  model: string;
  durationMs: number;
  // All the run's models together; null when the result gives no usage.
  tokens: Tokens | null;
}

export interface QuestionRunner {
  run(input: RunInput): Promise<RunResult>;
}

export function claudeArgsOf(sessionId: string): string[] {
  return [
    "-p",
    ...["--model", QUESTION_MODEL],
    ...["--output-format", "json"],
    ...["--session-id", sessionId],
    // The only tools it has, all of them approved: nothing writes, nothing runs a command, no subagent.
    ...["--tools", READ_TOOLS],
    ...["--allowedTools", READ_TOOLS],
    ...["--permission-mode", "dontAsk"],
    // No hook, the plugins' included; no skill nor slash command; no MCP server.
    ...["--settings", JSON.stringify({ disableAllHooks: true })],
    "--disable-slash-commands",
    "--strict-mcp-config",
  ];
}

// Claude Code refuses to start inside another session's environment (an API started from a session).
const SESSION_ENV = ["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SSE_PORT"];

export function runEnvOf(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const copy = { ...env };
  for (const key of SESSION_ENV) delete copy[key];
  return copy;
}

const resultSchema = z.looseObject({
  is_error: z.boolean().optional(),
  result: z.string().optional(),
  duration_ms: z.number().nonnegative().optional(),
  modelUsage: z
    .record(
      z.string(),
      z.looseObject({
        inputTokens: z.number().optional(),
        outputTokens: z.number().optional(),
        cacheReadInputTokens: z.number().optional(),
        cacheCreationInputTokens: z.number().optional(),
      }),
    )
    .optional(),
});

type ModelUsage = NonNullable<z.infer<typeof resultSchema>["modelUsage"]>;

// The model that wrote the most: a run may also call a small model on the side.
function modelOf(usage: ModelUsage | undefined): string {
  const entries = Object.entries(usage ?? {});
  const [first, ...rest] = entries;
  if (first === undefined) return QUESTION_MODEL;
  return rest.reduce((best, cur) => ((cur[1].outputTokens ?? 0) > (best[1].outputTokens ?? 0) ? cur : best), first)[0];
}

// `question` BR-04: every model of the run, a small one on the side included.
function tokensOf(usage: ModelUsage | undefined): Tokens | null {
  const entries = Object.values(usage ?? {});
  if (entries.length === 0) return null;
  const sum = (pick: (u: ModelUsage[string]) => number | undefined) => Math.round(entries.reduce((total, u) => total + (pick(u) ?? 0), 0));
  return {
    input: sum((u) => u.inputTokens),
    cacheRead: sum((u) => u.cacheReadInputTokens),
    cacheWrite: sum((u) => u.cacheCreationInputTokens),
    output: sum((u) => u.outputTokens),
  };
}

export function parseResult(stdout: string, elapsedMs: number): RunResult {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw new RunError("run-failed", "Claude Code's output is not JSON");
  }
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success || parsed.data.result === undefined) throw new RunError("run-failed", "Claude Code's output holds no result");
  if (parsed.data.is_error === true) throw new RunError("run-failed", parsed.data.result);
  return {
    answer: parsed.data.result,
    model: modelOf(parsed.data.modelUsage),
    durationMs: Math.round(parsed.data.duration_ms ?? elapsedMs),
    tokens: tokensOf(parsed.data.modelUsage),
  };
}

const OUTPUT_CAP = 4 * 1024 * 1024;
// A stopped run frees its place once its process is gone, or after this delay if it never says so.
const KILL_GRACE_MS = 5000;
const STDERR_TAIL = 2000;

// The JSON result's own error, when the output holds one.
function resultError(stdout: string): RunError | null {
  try {
    parseResult(stdout, 0);
    return null;
  } catch (error) {
    return error instanceof RunError && error.detail !== null && !error.detail.startsWith("Claude Code's output") ? error : null;
  }
}

// On Windows `kill` ends `claude.exe` alone, not the processes it started: `taskkill /T` ends the tree, no shell.
function killTree(child: ChildProcessWithoutNullStreams): void {
  if (process.platform === "win32" && child.pid !== undefined) {
    const killer = nodeSpawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    killer.on("error", () => child.kill());
    return;
  }
  child.kill();
}

export type Spawn = (command: string, args: string[], options: SpawnOptionsWithoutStdio) => ChildProcessWithoutNullStreams;

// `bin`: `claude` on the PATH, else CLAUDE_BIN. No shell: the prompt goes on stdin, the arguments as they are. On Windows
// a `claude.cmd` cannot start without a shell: CLAUDE_BIN then names the executable.
export function createClaudeRunner({ bin, spawn = nodeSpawn, env = process.env }: { bin: string; spawn?: Spawn; env?: NodeJS.ProcessEnv }): QuestionRunner {
  return {
    run: ({ cwd, prompt, sessionId, signal }) =>
      new Promise<RunResult>((resolve, reject) => {
        const startedAt = performance.now();
        let child: ChildProcessWithoutNullStreams;
        try {
          child = spawn(bin, claudeArgsOf(sessionId), { cwd, env: runEnvOf(env), shell: false, windowsHide: true });
        } catch (error) {
          reject(new RunError("missing-binary", error instanceof Error ? error.message : String(error)));
          return;
        }
        let stdout = "";
        let stderr = "";
        let isSettled = false;
        const settle = (fn: () => void) => {
          if (isSettled) return;
          isSettled = true;
          signal.removeEventListener("abort", onAbort);
          fn();
        };
        let isStopping = false;
        const onAbort = () => {
          if (isStopping) return;
          isStopping = true;
          killTree(child);
          // Rejected once the process is gone (its close event), so that a new run never starts beside a dying one.
          setTimeout(() => settle(() => reject(new RunError("run-failed", "stopped"))), KILL_GRACE_MS).unref();
        };
        signal.addEventListener("abort", onAbort);
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          if (stdout.length < OUTPUT_CAP) stdout += chunk;
        });
        child.stderr.on("data", (chunk: string) => {
          stderr = (stderr + chunk).slice(-STDERR_TAIL);
        });
        child.on("error", (error: NodeJS.ErrnoException) => {
          const code = error.code === "ENOENT" || error.code === "EINVAL" || error.code === "EACCES" ? "missing-binary" : "run-failed";
          settle(() => reject(new RunError(code, error.message)));
        });
        child.on("close", (exitCode) => {
          settle(() => {
            if (isStopping) {
              reject(new RunError("run-failed", "stopped"));
              return;
            }
            if (exitCode !== 0) {
              // An API error exits non-zero with its words in the JSON result, stderr empty.
              reject(resultError(stdout) ?? new RunError("run-failed", stderr.trim() || `exit code ${String(exitCode)}`));
              return;
            }
            try {
              resolve(parseResult(stdout, performance.now() - startedAt));
            } catch (error) {
              reject(error instanceof Error ? error : new RunError("run-failed", String(error)));
            }
          });
        });
        // A run that dies before reading its prompt breaks the pipe: its close event says why.
        child.stdin.on("error", () => undefined);
        child.stdin.end(prompt);
        if (signal.aborted) onAbort();
      }),
  };
}
