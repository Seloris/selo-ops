import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createClaudeLauncher, launchArgsOf, LaunchError, remoteControlNameOf } from "../../src/features/launches/launches.launcher.js";
import type { Spawn } from "../../src/features/questions/questions.runner.js";

// `session` BR-24: how a session is started, read on a fake child process: never the real `claude`.

function fakeChild() {
  const emitter = new EventEmitter();
  Object.assign(emitter, { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true });
  const child = emitter as unknown as ChildProcessWithoutNullStreams;
  return { child, out: child.stdout as PassThrough, err: child.stderr as PassThrough };
}

function launcherWith(spawnImpl: Spawn, timeoutMs?: number) {
  const calls: Parameters<Spawn>[] = [];
  const spawn: Spawn = (...args) => {
    calls.push(args);
    return spawnImpl(...args);
  };
  const env = { CLAUDECODE: "1", PATH: "x" };
  return { launcher: createClaudeLauncher({ bin: "claude", spawn, env, ...(timeoutMs === undefined ? {} : { timeoutMs }) }), calls };
}

const input = { cwd: "C:/code/ledger-api", name: "ledger-api · Ajoute un tag", command: "/selo-flow:pilot Ajoute un tag", isAutoMode: false };
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("launchArgsOf", () => {
  it("starts in the background with Remote Control named, the command last", () => {
    // Act
    const args = launchArgsOf(input);

    // Assert
    expect(args).toEqual(["--bg", "--remote-control", "ledger-api · Ajoute un tag", "/selo-flow:pilot Ajoute un tag"]);
  });

  it("adds Claude Code's auto mode with « Mode auto »", () => {
    // Act
    const args = launchArgsOf({ ...input, isAutoMode: true });

    // Assert
    expect(args).toEqual(["--bg", "--remote-control", "ledger-api · Ajoute un tag", "--permission-mode", "auto", "/selo-flow:pilot Ajoute un tag"]);
  });
});

describe("remoteControlNameOf", () => {
  it("names the session after the project and the request", () => {
    // Act
    const name = remoteControlNameOf("ledger-api", "Ajoute un tag");

    // Assert
    expect(name).toBe("ledger-api · Ajoute un tag");
  });

  it("cuts the request to 40 characters, on one line", () => {
    // Act
    const name = remoteControlNameOf("ledger-api", "Ajoute une date d'échéance\n  optionnelle aux tâches, triée par défaut");

    // Assert
    const request = name.slice("ledger-api · ".length);
    expect(request.length).toBeLessThanOrEqual(40);
    expect(request.startsWith("Ajoute une date d'échéance optionnel")).toBe(true);
    expect(request.endsWith("…")).toBe(true);
    expect(request).not.toContain("\n");
  });
});

describe("createClaudeLauncher", () => {
  it("runs claude in the folder, no shell, outside the session's environment, and returns the printed id", async () => {
    // Arrange
    const fake = fakeChild();
    const { launcher, calls } = launcherWith(() => fake.child);

    // Act
    const launched = launcher.launch(input);
    fake.out.write("Started in the background.\nbg-7f3a\n");
    await flush();
    fake.child.emit("exit", 0);

    // Assert
    expect(await launched).toEqual({ id: "bg-7f3a" });
    const [command, args, options] = calls[0] ?? [];
    expect(command).toBe("claude");
    expect(args).toEqual(launchArgsOf(input));
    expect(options).toMatchObject({ cwd: "C:/code/ledger-api", shell: false });
    expect(options?.env).not.toHaveProperty("CLAUDECODE");
  });

  it("returns no id when claude prints none", async () => {
    // Arrange
    const fake = fakeChild();
    const { launcher } = launcherWith(() => fake.child);

    // Act
    const launched = launcher.launch(input);
    fake.child.emit("exit", 0);

    // Assert
    expect(await launched).toEqual({ id: null });
  });

  it("fails with missing-binary when claude is not found", async () => {
    // Arrange
    const fake = fakeChild();
    const { launcher } = launcherWith(() => fake.child);

    // Act
    const launched = launcher.launch(input);
    fake.child.emit("error", Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" }));

    // Assert
    await expect(launched).rejects.toBeInstanceOf(LaunchError);
    await expect(launched).rejects.toMatchObject({ code: "missing-binary" });
  });

  it("fails with launch-failed and claude's error when it exits non-zero", async () => {
    // Arrange
    const fake = fakeChild();
    const { launcher } = launcherWith(() => fake.child);

    // Act
    const launched = launcher.launch(input);
    fake.err.write("Not logged in\n");
    await flush();
    fake.child.emit("exit", 1);

    // Assert
    await expect(launched).rejects.toMatchObject({ code: "launch-failed", detail: "Not logged in" });
  });

  it("fails with launch-failed when claude does not return in time", async () => {
    // Arrange
    const fake = fakeChild();
    const { launcher } = launcherWith(() => fake.child, 20);

    // Act
    const launched = launcher.launch(input);

    // Assert
    await expect(launched).rejects.toMatchObject({ code: "launch-failed" });
  });
});
