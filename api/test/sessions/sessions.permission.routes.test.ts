import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ExportRun } from "../../src/features/sessions/sessions.export.js";
import { sessionsResponseSchema, type Session } from "../../src/features/sessions/sessions.schema.js";
import { buildRun, buildRunningStatusFile, buildSessionFile, transcriptFolderOf } from "../factories.js";
import { createTestContext } from "../setup.js";

// A session waiting on a permission dialog (`session` BR-16): Claude Code's status file of its running process says so,
// its transcript names the tool to allow.

const EPOCH = Date.parse("2026-01-01T00:00:00.000Z");
const at = (ms: number) => new Date(EPOCH + ms).toISOString();
// No process has this pid: the status file a crash left behind.
const DEAD_PID = 2 ** 30 + 7;

const prompt = (text: string) => ({ type: "user", uuid: "u-1", message: { role: "user", content: text } });
const toolUse = (id: string, name: string, input: Record<string, unknown> = {}) => ({
  type: "assistant",
  message: { id: `m-${id}`, model: "claude-opus-5-5", role: "assistant", content: [{ type: "tool_use", id, name, input }] },
});
const toolResult = (id: string) => ({
  type: "user",
  uuid: `r-${id}`,
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] },
});

describe("sessions waiting on a permission", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const only = async (): Promise<Session> => {
    const res = await request(ctx.app).get("/v1/sessions");
    expect(res.status).toBe(200);
    const { sessions } = sessionsResponseSchema.parse(res.body);
    expect(sessions).toHaveLength(1);
    return sessions[0];
  };

  // A session of the export whose running process waits, since EPOCH, on what `status` says, with its transcript.
  const exported = (
    {
      phase = "working",
      ...status
    }: Parameters<typeof buildRunningStatusFile>[0] & { phase?: ExportRun["phase"] } = {},
    lines: unknown[] = [prompt("Fix the build"), toolUse("t1", "Bash", { command: "npm test" })],
    file = buildSessionFile({ current: buildRun({ phase }) }),
  ) => {
    ctx.seed.session(file);
    ctx.seed.running(
      buildRunningStatusFile({ sessionId: file.sessionId, cwd: file.root, status: "waiting", waitingFor: "permission prompt", ...status }),
    );
    ctx.seed.transcript(file.rootKey, file.sessionId, lines);
    return file;
  };

  describe("GET /v1/sessions", () => {
    it("keeps the run's phase while the permission wait is under 15 s", async () => {
      // Arrange
      exported();
      ctx.clock.set(at(14_999));

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ state: "working", permissionTool: null });
    });

    it("gives a session waiting on a permission for 15 s « awaiting-permission », with the command to allow", async () => {
      // Arrange
      exported();
      ctx.clock.set(at(15_000));

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ state: "awaiting-permission", permissionTool: "npm test" });
    });

    it.each([["awaiting-answer"], ["awaiting-commit"], ["stopped"], ["turn-ended"], ["job-done"]] as const)(
      "overrides the export's phase %s",
      async (phase) => {
        // Arrange
        exported({ phase });
        ctx.clock.set(at(60_000));

        // Act
        const session = await only();

        // Assert
        expect(session.state).toBe("awaiting-permission");
      },
    );

    it.each([
      ["permission prompt", "awaiting-permission"],
      ["sandbox request", "awaiting-permission"],
      ["worker request", "turn-ended"],
      ["goal proposal", "turn-ended"],
      ["input needed", "turn-ended"],
      [null, "turn-ended"],
    ] as const)("gives a wait on %s the state %s", async (waitingFor, state) => {
      // Arrange
      exported({ phase: "turn-ended", waitingFor });
      ctx.clock.set(at(60_000));

      // Act
      const session = await only();

      // Assert
      expect(session.state).toBe(state);
    });

    it.each([["busy"], ["idle"]] as const)("keeps the run's phase while the process is %s", async (status) => {
      // Arrange
      exported({ phase: "turn-ended", status });
      ctx.clock.set(at(60_000));

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ state: "turn-ended", permissionTool: null });
    });

    it("keeps the run's phase when the waiting process is gone", async () => {
      // Arrange
      exported({ pid: DEAD_PID });
      ctx.clock.set(at(60_000));

      // Act
      const session = await only();

      // Assert
      expect(session.state).toBe("working");
    });

    it("keeps the phase of a closed session", async () => {
      // Arrange
      exported({}, undefined, buildSessionFile({ status: "ended", current: buildRun({ phase: "stopped" }) }));
      ctx.clock.set(at(60_000));

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ state: "stopped", isClosed: true, permissionTool: null });
    });

    it("takes the latest status file of a session that has two", async () => {
      // Arrange
      const file = exported({ updatedAt: EPOCH });
      const resumed = buildRunningStatusFile({ sessionId: file.sessionId, cwd: file.root, status: "busy", updatedAt: EPOCH + 1 });
      ctx.seed.rawStatus(`resumed-${file.sessionId}.json`, JSON.stringify(resumed));
      ctx.clock.set(at(60_000));

      // Act
      const session = await only();

      // Assert
      expect(session.state).toBe("working");
    });

    it("finds the transcript in another folder when the export's folder has none", async () => {
      // Arrange
      const file = buildSessionFile({ current: buildRun() });
      ctx.seed.session(file);
      ctx.seed.running(buildRunningStatusFile({ sessionId: file.sessionId, cwd: file.root, status: "waiting", waitingFor: "permission prompt" }));
      ctx.seed.transcript("elsewhere", file.sessionId, [toolUse("t1", "Bash", { command: "git status" })]);
      ctx.clock.set(at(60_000));

      // Act
      const session = await only();

      // Assert
      expect(session.permissionTool).toBe("git status");
    });

    it("gives a session outside selo waiting on a permission for 15 s « awaiting-permission », with its tool", async () => {
      // Arrange
      const cwd = ctx.code.folder("scratch");
      const status = buildRunningStatusFile({ cwd, status: "waiting", waitingFor: "sandbox request" });
      ctx.seed.running(status);
      ctx.seed.transcript(transcriptFolderOf(cwd), status.sessionId, [prompt("Clean up"), toolUse("t1", "Write", { file_path: "a.ts" })]);
      ctx.clock.set(at(15_000));

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ isOutsideSelo: true, state: "awaiting-permission", permissionTool: "Write" });
    });

    it.each([
      ["a shell command", [toolUse("t1", "Bash", { command: "rm -rf dist" })], "rm -rf dist"],
      ["a terminal command", [toolUse("t1", "mcp__terminal__run_in_terminal", { command: "npm run dev" })], "npm run dev"],
      ["another tool", [toolUse("t1", "Edit", { file_path: "a.ts" })], "Edit"],
      ["the last open call", [toolUse("t1", "Bash", { command: "ls" }), toolResult("t1"), toolUse("t2", "WebFetch", { url: "x" })], "WebFetch"],
      ["no open call", [toolUse("t1", "Bash", { command: "ls" }), toolResult("t1")], null],
      ["an open subagent", [toolUse("t1", "Bash", { command: "ls" }), toolResult("t1"), toolUse("t2", "Agent", { prompt: "Go" })], null],
      ["an open task", [toolUse("t2", "Task", { prompt: "Go" })], null],
      ["no transcript line", [], null],
    ] as const)("names the tool to allow for %s", async (_case, lines, tool) => {
      // Arrange
      exported({}, [prompt("Fix the build"), ...lines]);
      ctx.clock.set(at(60_000));

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ state: "awaiting-permission", permissionTool: tool });
    });

    it("gives no tool to a session that waits on nothing", async () => {
      // Arrange
      ctx.seed.session(buildSessionFile({ current: buildRun({ phase: "awaiting-answer", question: "A or B?" }) }));

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ state: "awaiting-answer", permissionTool: null });
    });
  });
});
