import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from "node:child_process";
import { z } from "zod";

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

export interface RunResult {
  answer: string;
  model: string;
  durationMs: number;
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
  modelUsage: z.record(z.string(), z.looseObject({ outputTokens: z.number().optional() })).optional(),
});

type ModelUsage = Record<string, { outputTokens?: number | undefined }>;

// The model that wrote the most: a run may also call a small model on the side.
function modelOf(usage: ModelUsage | undefined): string {
  const entries = Object.entries(usage ?? {});
  const [first, ...rest] = entries;
  if (first === undefined) return QUESTION_MODEL;
  return rest.reduce((best, cur) => ((cur[1].outputTokens ?? 0) > (best[1].outputTokens ?? 0) ? cur : best), first)[0];
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
  return { answer: parsed.data.result, model: modelOf(parsed.data.modelUsage), durationMs: Math.round(parsed.data.duration_ms ?? elapsedMs) };
}

const OUTPUT_CAP = 4 * 1024 * 1024;
const STDERR_TAIL = 2000;

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
        const onAbort = () => {
          child.kill();
          settle(() => reject(new RunError("run-failed", "stopped")));
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
            if (exitCode !== 0) {
              reject(new RunError("run-failed", stderr.trim() || `exit code ${String(exitCode)}`));
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
