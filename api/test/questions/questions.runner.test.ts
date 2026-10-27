import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { describe, expect, it } from "vitest";
import { claudeArgsOf, createClaudeRunner, RunError, runEnvOf, type Spawn } from "../../src/features/questions/questions.runner.js";

// `question` BR-01, BR-02: how Claude Code is started, read on a fake child process: never the real `claude`.

interface FakeChild {
  child: ChildProcessWithoutNullStreams;
  stdin: string[];
  isKilled: () => boolean;
}

function fakeChild(): FakeChild {
  const emitter = new EventEmitter();
  const stdin = new PassThrough();
  const written: string[] = [];
  stdin.on("data", (chunk: Buffer) => written.push(chunk.toString()));
  let isKilled = false;
  Object.assign(emitter, {
    stdin,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: () => {
      isKilled = true;
      return true;
    },
  });
  return { child: emitter as unknown as ChildProcessWithoutNullStreams, stdin: written, isKilled: () => isKilled };
}

function runnerWith(fake: FakeChild, env: NodeJS.ProcessEnv = {}) {
  const calls: { command: string; args: string[]; options: Parameters<Spawn>[2] }[] = [];
  const spawn: Spawn = (command, args, options) => {
    calls.push({ command, args, options });
    return fake.child;
  };
  return { runner: createClaudeRunner({ bin: "claude", spawn, env }), calls };
}

const SESSION = "11111111-2222-4333-8444-555555555555";
const input = (signal = new AbortController().signal) => ({ cwd: "C:/code/ledger-api", prompt: "Explain", sessionId: SESSION, signal });
const out = (fake: FakeChild) => fake.child.stdout as PassThrough;
const err = (fake: FakeChild) => fake.child.stderr as PassThrough;
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("claudeArgsOf", () => {
  it("starts a headless, read-only run on Sonnet, with no hook, skill nor MCP server", () => {
    // Act
    const args = claudeArgsOf(SESSION);

    // Assert
    const after = (flag: string) => args[args.indexOf(flag) + 1];
    expect(args).toContain("-p");
    expect(after("--model")).toBe("sonnet");
    expect(after("--output-format")).toBe("json");
    expect(after("--session-id")).toBe(SESSION);
    expect(after("--tools")).toBe("Read,Grep,Glob");
    expect(after("--allowedTools")).toBe("Read,Grep,Glob");
    expect(after("--permission-mode")).toBe("dontAsk");
    expect(JSON.parse(after("--settings") ?? "{}")).toEqual({ disableAllHooks: true });
    expect(args).toContain("--disable-slash-commands");
    expect(args).toContain("--strict-mcp-config");
    expect(args.join(" ")).not.toMatch(/Bash|Edit|Write|dangerously/);
  });
});

describe("runEnvOf", () => {
  it("drops the variables of the session Selo Ops may run in", () => {
    // Act
    const env = runEnvOf({ PATH: "x", CLAUDECODE: "1", CLAUDE_CODE_ENTRYPOINT: "cli" });

    // Assert
    expect(env).toEqual({ PATH: "x" });
  });
});

describe("createClaudeRunner", () => {
  it("spawns the binary without a shell in the checkout, the prompt on stdin, and reads the JSON result", async () => {
    // Arrange
    const fake = fakeChild();
    const { runner, calls } = runnerWith(fake, { CLAUDECODE: "1", PATH: "p" });

    // Act
    const pending = runner.run(input());
    await flush();
    out(fake).write(JSON.stringify({ type: "result", is_error: false, result: "Réponse", duration_ms: 1234, modelUsage: { "claude-haiku-5-5": { outputTokens: 10 }, "claude-sonnet-5-5": { outputTokens: 900 } } }));
    fake.child.emit("close", 0);

    // Assert
    await expect(pending).resolves.toEqual({ answer: "Réponse", model: "claude-sonnet-5-5", durationMs: 1234 });
    expect(calls[0]).toMatchObject({ command: "claude", options: { cwd: "C:/code/ledger-api", shell: false, env: { PATH: "p" } } });
    expect(fake.stdin.join("")).toBe("Explain");
  });

  it("fails with missing-binary when the executable is not found", async () => {
    // Arrange
    const fake = fakeChild();
    const { runner } = runnerWith(fake);

    // Act
    const pending = runner.run(input());
    fake.child.emit("error", Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" }));

    // Assert
    await expect(pending).rejects.toMatchObject({ code: "missing-binary" });
  });

  it("fails with its error output on a non-zero exit", async () => {
    // Arrange
    const fake = fakeChild();
    const { runner } = runnerWith(fake);

    // Act
    const pending = runner.run(input());
    await flush();
    err(fake).write("Not logged in");
    await flush();
    fake.child.emit("close", 1);

    // Assert
    await expect(pending).rejects.toEqual(new RunError("run-failed", "Not logged in"));
  });

  it("fails with the result's text when Claude Code reports an error", async () => {
    // Arrange
    const fake = fakeChild();
    const { runner } = runnerWith(fake);

    // Act
    const pending = runner.run(input());
    await flush();
    out(fake).write(JSON.stringify({ is_error: true, result: "API Error: 529" }));
    fake.child.emit("close", 0);

    // Assert
    await expect(pending).rejects.toMatchObject({ code: "run-failed", detail: "API Error: 529" });
  });

  it("kills the process when the run is aborted", async () => {
    // Arrange
    const fake = fakeChild();
    const { runner } = runnerWith(fake);
    const controller = new AbortController();

    // Act
    const pending = runner.run(input(controller.signal));
    controller.abort("timeout");

    // Assert
    await expect(pending).rejects.toBeInstanceOf(RunError);
    expect(fake.isKilled()).toBe(true);
  });
});
