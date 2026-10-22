import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sessionsResponseSchema, type Session } from "../../src/features/sessions/sessions.schema.js";
import {
  buildRun,
  buildRunningStatusFile,
  buildRunUsage,
  buildSessionFile,
  buildTokens,
  buildUsage,
  transcriptFolderOf,
} from "../factories.js";
import { createTestContext } from "../setup.js";

// Usage since the plugin's 2.2.0 (`session` BR-18, BR-19, BR-20): read from the export, never counted.

const SONNET = "claude-sonnet-5-5";
const HAIKU = "claude-haiku-5-5";

describe("sessions usage", () => {
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

  describe("GET /v1/sessions", () => {
    it("returns the session's totals and its current run's usage as the export gives them", async () => {
      // Arrange
      const usage = buildUsage({ calls: 80, tokens: buildTokens({ input: 5 }) });
      const runUsage = buildRunUsage({
        skills: [
          { name: "selo:build", count: 1, how: "command" },
          { name: "write-api-tests", count: 2, how: "tool" },
          { name: "caveman", count: 1, how: "someday-new" },
        ],
        prompts: [
          { at: null, calls: 3, tokens: buildTokens() },
          { at: "2026-01-01T10:00:00.000Z", calls: 9, tokens: buildTokens() },
        ],
        settled: false,
        partial: true,
      });
      ctx.seed.session(buildSessionFile({ usage, current: buildRun({ usage: runUsage }) }));

      // Act
      const session = await only();

      // Assert
      expect(session.usage).toEqual(usage);
      expect(session.runUsage).toEqual(runUsage);
    });

    it("gives each subagent of the current run its real model and its usage", async () => {
      // Arrange
      const current = buildRun({ since: "2026-01-01T09:00:00.000Z" });
      const tokens = buildTokens({ output: 400 });
      const agentUsage = buildRunUsage({ calls: 4, tokens, byModel: [{ model: HAIKU, calls: 4, tokens }], prompts: [] });
      const runner = buildRun({ agentId: "a-1", request: "selo:runner", since: "2026-01-01T09:05:00.000Z", usage: agentUsage });
      const stopped = buildRun({ agentId: "a-2", request: "selo:reviewer", since: "2026-01-01T09:06:00.000Z", usage: null });
      ctx.seed.session(buildSessionFile({ current, runs: [stopped, runner, current] }));

      // Act
      const session = await only();

      // Assert
      expect(session.subagents).toEqual([
        { type: "selo:reviewer", task: null, state: "working", model: null, usage: null },
        { type: "selo:runner", task: null, state: "working", model: HAIKU, usage: { calls: 4, tokens, byModel: [{ model: HAIKU, calls: 4, tokens }] } },
      ]);
    });

    it("still lists a session written before 2.2.0, with no usage", async () => {
      // Arrange
      const file = buildSessionFile();
      expect(Object.keys(file)).not.toContain("usage");
      expect(Object.keys(file.current ?? {})).not.toContain("usage");
      ctx.seed.session(file);

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ id: file.sessionId, usage: null, runUsage: null });
    });

    it("still lists a session whose usage does not read, with no usage", async () => {
      // Arrange
      const file = buildSessionFile();
      const broken = {
        ...file,
        usage: { calls: "many", tokens: null },
        current: { ...file.current, usage: { calls: 3, tokens: buildTokens(), byModel: [] } },
        runs: [{ ...file.current, usage: { calls: 3, tokens: buildTokens(), byModel: [] } }],
      };
      ctx.seed.raw("sessions", `${file.sessionId}.json`, JSON.stringify(broken));

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ id: file.sessionId, usage: null, runUsage: null });
    });

    it("takes the session's model from its latest main run with usage when the export gives none, never a subagent's", async () => {
      // Arrange
      const tokens = buildTokens();
      const older = buildRun({ since: "2026-01-01T08:00:00.000Z", usage: buildRunUsage({ byModel: [{ model: HAIKU, calls: 1, tokens }] }) });
      const latest = buildRun({ since: "2026-01-01T09:00:00.000Z", usage: buildRunUsage({ byModel: [{ model: SONNET, calls: 1, tokens }] }) });
      const current = buildRun({ since: "2026-01-01T10:00:00.000Z", usage: null });
      const agent = buildRun({
        agentId: "a-1",
        since: "2026-01-01T10:01:00.000Z",
        usage: buildRunUsage({ byModel: [{ model: "claude-opus-5-5", calls: 1, tokens }] }),
      });
      ctx.seed.session(buildSessionFile({ model: null, current, runs: [agent, current, latest, older] }));

      // Act
      const session = await only();

      // Assert
      expect(session.model).toBe(SONNET);
    });

    it("keeps the export's model when it gives one", async () => {
      // Arrange
      const tokens = buildTokens();
      const current = buildRun({ usage: buildRunUsage({ byModel: [{ model: HAIKU, calls: 1, tokens }] }) });
      ctx.seed.session(buildSessionFile({ model: SONNET, current }));

      // Act
      const session = await only();

      // Assert
      expect(session.model).toBe(SONNET);
    });

    it("gives no model when neither the export nor any main run's usage names one", async () => {
      // Arrange
      const current = buildRun({ usage: buildRunUsage({ byModel: [] }) });
      const agent = buildRun({ agentId: "a-1", usage: buildRunUsage() });
      ctx.seed.session(buildSessionFile({ model: null, current, runs: [agent, current] }));

      // Act
      const session = await only();

      // Assert
      expect(session.model).toBeNull();
    });

    it("gives a session outside selo no usage and its transcript's model", async () => {
      // Arrange
      const cwd = ctx.code.folder("scratch");
      const status = buildRunningStatusFile({ cwd });
      ctx.seed.running(status);
      ctx.seed.transcript(transcriptFolderOf(cwd), status.sessionId, [
        { type: "user", uuid: "u-1", message: { role: "user", content: "Fix the build" } },
        { type: "assistant", message: { id: "m1", model: SONNET, role: "assistant", content: [{ type: "text", text: "Done." }] } },
      ]);

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ isOutsideSelo: true, model: SONNET, usage: null, runUsage: null });
    });
  });
});
