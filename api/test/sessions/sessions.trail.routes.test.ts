import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ExportTrailEntry } from "../../src/features/sessions/sessions.export.js";
import { sessionsResponseSchema, sessionTrailsSchema, type Session } from "../../src/features/sessions/sessions.schema.js";
import { buildRun, buildSessionFile } from "../factories.js";
import { createTestContext } from "../setup.js";

// `session` BR-22 and sessions-live FR-41: the type of work (flow › skill) and the current run's trail.
describe("sessions routes — run trail", () => {
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

  const trail: ExportTrailEntry[] = [
    { at: "2026-01-01T09:00:00.000Z", skill: "pilot", step: null, substep: null, phase: "working" },
    { at: "2026-01-01T09:05:00.000Z", skill: "build", step: "stage:1", substep: "tests", phase: "working" },
    { at: "2026-01-01T09:20:00.000Z", skill: "build", step: "stage:1", substep: "commit", phase: "awaiting-commit" },
  ];

  it("gives the flow, the skill and the trail of the current run", async () => {
    // Arrange
    ctx.seed.session(buildSessionFile({ current: buildRun({ flow: "pilot", skill: "build", mode: "autonomous", trail, trailCut: true }) }));

    // Act
    const session = await only();

    // Assert
    expect(session).toMatchObject({ flow: "pilot", skill: "build", mode: "autonomous", trail, isTrailCut: true });
    expect(session).not.toHaveProperty("lane");
  });

  it.each([
    ["an interactive pilot", { flow: "pilot", skill: "fastlane", mode: null }, { flow: "pilot", skill: "fastlane", mode: null }],
    ["an autonomous pilot", { flow: "pilot", skill: "build", mode: "autonomous" }, { flow: "pilot", skill: "build", mode: "autonomous" }],
    ["a free run with a tool skill", { flow: "free", skill: "review", mode: null }, { flow: "free", skill: "review", mode: null }],
  ] as const)("gives %s its flow, skill and mode as the export writes them", async (_, run, expected) => {
    // Arrange
    ctx.seed.session(buildSessionFile({ current: buildRun(run) }));

    // Act
    const session = await only();

    // Assert
    expect(session).toMatchObject(expected);
  });

  it("reads a run with no flow as a free one, whatever lane it still carries", async () => {
    // Arrange
    const run: Record<string, unknown> = { ...buildRun(), lane: "build", skill: null };
    delete run.flow;
    const file = { ...buildSessionFile(), runs: [run], current: run };
    ctx.seed.raw("sessions", `${file.sessionId}.json`, JSON.stringify(file));

    // Act
    const session = await only();

    // Assert
    expect(session).toMatchObject({ id: file.sessionId, flow: "free", skill: null });
  });

  it("keeps the session when its trail is malformed, with an empty trail", async () => {
    // Arrange
    const run = { ...buildRun(), flow: "fastlane", skill: "fastlane", trail: "not a list", trailCut: "yes" };
    const file = { ...buildSessionFile(), runs: [run], current: run };
    ctx.seed.raw("sessions", `${file.sessionId}.json`, JSON.stringify(file));

    // Act
    const session = await only();

    // Assert
    expect(session).toMatchObject({ id: file.sessionId, flow: "fastlane", trail: [], isTrailCut: false });
  });

  it("drops a malformed trail entry and keeps its siblings", async () => {
    // Arrange
    const run = { ...buildRun(), flow: "fastlane", skill: "fastlane", trail: [trail[0], { at: 42 }, trail[1]] };
    const file = { ...buildSessionFile(), runs: [run], current: run };
    ctx.seed.raw("sessions", `${file.sessionId}.json`, JSON.stringify(file));

    // Act
    const session = await only();

    // Assert
    expect(session.trail).toEqual([trail[0], trail[1]]);
  });

  it("reads a fastlane's iterate mode from the run's mode", async () => {
    // Arrange
    ctx.seed.session(buildSessionFile({ current: buildRun({ flow: "fastlane", skill: "fastlane", mode: "iterate", request: "Resserrer la liste" }) }));

    // Act
    const session = await only();

    // Assert
    expect(session.mode).toBe("iterate");
  });

  it("reads no mode from a request carrying the option when the run has none", async () => {
    // Arrange
    const run: Record<string, unknown> = { ...buildRun({ flow: "fastlane", skill: "fastlane" }), request: "Resserrer la liste — iterate" };
    delete run.mode;
    const file = { ...buildSessionFile(), runs: [run], current: run };
    ctx.seed.raw("sessions", `${file.sessionId}.json`, JSON.stringify(file));

    // Act
    const session = await only();

    // Assert
    expect(session.mode).toBeNull();
  });
});

// sessions-live FR-41: the earlier prompts' history, read when the detail shows the session.
describe("sessions routes — earlier runs' trails", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const trail: ExportTrailEntry[] = [
    { at: "2026-01-01T08:00:00.000Z", skill: "fastlane", step: null, substep: "code", phase: "working" },
    { at: "2026-01-01T08:20:00.000Z", skill: "fastlane", step: null, substep: "commit", phase: "job-done" },
  ];

  const trailsOf = async (id: string) => {
    const res = await request(ctx.app).get(`/v1/sessions/${id}/trails`);
    expect(res.status).toBe(200);
    return sessionTrailsSchema.parse(res.body).runs;
  };

  it("gives each earlier main run its history, mode and the subagents started before the next one, never the current run", async () => {
    // Arrange
    const first = buildRun({ since: "2026-01-01T08:00:00.000Z", request: "Ajoute un filtre", mode: "iterate", trail, trailCut: true });
    const agent = buildRun({ agentId: "a-1", request: "runner", task: "runner · web tests", since: "2026-01-01T08:10:00.000Z", updatedAt: "2026-01-01T08:12:00.000Z", phase: "job-done" });
    const atNext = buildRun({ agentId: "a-2", request: "reviewer", since: "2026-01-01T09:00:00.000Z" });
    const current = buildRun({ since: "2026-01-01T09:00:00.000Z", trail });
    const file = buildSessionFile({ current, runs: [current, atNext, agent, first] });
    ctx.seed.session(file);

    // Act
    const runs = await trailsOf(file.sessionId);

    // Assert
    expect(runs).toEqual([
      {
        since: first.since,
        request: "Ajoute un filtre",
        isRequestCut: false,
        isRequestImage: false,
        mode: "iterate",
        trail,
        isTrailCut: true,
        subagents: [{ type: "runner", task: "runner · web tests", state: "job-done", since: agent.since, updatedAt: agent.updatedAt, model: null, usage: null }],
      },
    ]);
  });

  it("bounds the last earlier run by a current run the export's runs do not hold yet", async () => {
    // Arrange
    const first = buildRun({ since: "2026-01-01T08:00:00.000Z", trail });
    const agent = buildRun({ agentId: "a-1", request: "runner", since: "2026-01-01T09:10:00.000Z" });
    const current = buildRun({ since: "2026-01-01T09:00:00.000Z", trail });
    const file = buildSessionFile({ current, runs: [agent, first] });
    ctx.seed.session(file);

    // Act
    const runs = await trailsOf(file.sessionId);

    // Assert
    expect(runs).toHaveLength(1);
    expect(runs[0]?.subagents).toEqual([]);
  });

  it("returns 404 for a session the export does not hold", async () => {
    // Act
    const res = await request(ctx.app).get("/v1/sessions/unknown/trails");

    // Assert
    expect(res.status).toBe(404);
  });
});
