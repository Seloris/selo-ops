import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { killTree, runEnvOf, type Spawn } from "../questions/questions.runner.js";

// `session` BR-24: a Claude Code session started in the background with Remote Control on; the selo plugins' hooks
// export it like any other session.

export type LaunchErrorCode = "missing-binary" | "launch-failed" | "timeout";

export class LaunchError extends Error {
  constructor(
    readonly code: LaunchErrorCode,
    readonly detail: string | null,
  ) {
    super(detail ?? code);
    this.name = "LaunchError";
  }
}

export interface LaunchInput {
  // The checkout the session starts in.
  cwd: string;
  // The Remote Control name.
  name: string;
  // The session's first prompt.
  command: string;
  // Claude Code's auto mode instead of the person's own permission settings.
  isAutoMode: boolean;
}

export interface SessionLauncher {
  // The id `claude --bg` prints, null when it prints none.
  launch(input: LaunchInput): Promise<{ id: string | null }>;
}

export const NAME_MAX = 40;

// « {projet} · {demande} », the request on one line and cut to 40 characters.
export function remoteControlNameOf(project: string, request: string): string {
  const line = request.replace(/\s+/g, " ").trim();
  const cut = line.length > NAME_MAX ? `${line.slice(0, NAME_MAX - 1).trimEnd()}…` : line;
  return `${project} · ${cut}`;
}

export function launchArgsOf({ name, command, isAutoMode }: Omit<LaunchInput, "cwd">): string[] {
  return ["--bg", ...["--remote-control", name], ...(isAutoMode ? ["--permission-mode", "auto"] : []), command];
}

// `--bg` returns at once; past this delay the start is a failure.
export const LAUNCH_TIMEOUT_MS = 30_000;
const OUTPUT_TAIL = 2000;
// The output may still arrive after the exit (on Windows above all): read until its end, at most this long.
const DRAIN_MS = 200;
const ID_MAX = 200;

const lastLineOf = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .pop() ?? null;

// No shell: the command goes as one argument, as it is. On Windows a `claude.cmd` cannot start without a shell:
// CLAUDE_BIN then names the executable, as for the questions.
export function createClaudeLauncher({
  bin,
  spawn = nodeSpawn,
  env = process.env,
  timeoutMs = LAUNCH_TIMEOUT_MS,
}: {
  bin: string;
  spawn?: Spawn;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): SessionLauncher {
  return {
    launch: ({ cwd, ...input }) =>
      new Promise((resolve, reject) => {
        let child: ChildProcessWithoutNullStreams;
        try {
          child = spawn(bin, launchArgsOf(input), { cwd, env: runEnvOf(env), shell: false, windowsHide: true });
        } catch (error) {
          reject(new LaunchError("missing-binary", error instanceof Error ? error.message : String(error)));
          return;
        }
        let stdout = "";
        let stderr = "";
        let isSettled = false;
        const settle = (fn: () => void) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timer);
          fn();
        };
        // Its whole tree ended, so that a start given up on never goes on to start a session.
        const timer = setTimeout(() => {
          killTree(child);
          settle(() => reject(new LaunchError("timeout", null)));
        }, timeoutMs);
        timer.unref();
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          stdout = (stdout + chunk).slice(-OUTPUT_TAIL);
        });
        child.stderr.on("data", (chunk: string) => {
          stderr = (stderr + chunk).slice(-OUTPUT_TAIL);
        });
        child.on("error", (error: NodeJS.ErrnoException) => {
          const code = error.code === "ENOENT" || error.code === "EINVAL" || error.code === "EACCES" ? "missing-binary" : "launch-failed";
          settle(() => reject(new LaunchError(code, error.message)));
        });
        // `exit`, not `close`: the background session may keep the pipes it inherited open.
        child.on("exit", (exitCode) => {
          const finish = () => {
            clearTimeout(drain);
            child.stdout.destroy();
            child.stderr.destroy();
            settle(() => {
              if (exitCode !== 0) {
                reject(new LaunchError("launch-failed", stderr.trim() || stdout.trim() || `exit code ${String(exitCode)}`));
                return;
              }
              resolve({ id: lastLineOf(stdout)?.slice(0, ID_MAX) ?? null });
            });
          };
          const drain = setTimeout(finish, DRAIN_MS);
          if (child.stdout.readableEnded) finish();
          else child.stdout.once("end", finish);
        });
        child.stdin.on("error", () => undefined);
        child.stdin.end();
      }),
  };
}
