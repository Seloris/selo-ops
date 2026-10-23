import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ExportTrailEntry } from "../../src/features/sessions/sessions.export.js";
import { sessionsResponseSchema, type Session } from "../../src/features/sessions/sessions.schema.js";
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
    { at: "2026-01-01T09:00:00.000Z", skill: "autopilot", step: null, substep: null, phase: "working" },
    { at: "2026-01-01T09:05:00.000Z", skill: "build", step: "stage:1", substep: "tests", phase: "working" },
    { at: "2026-01-01T09:20:00.000Z", skill: "build", step: "stage:1", substep: "commit", phase: "awaiting-commit" },
  ];

  it("gives the flow, the skill and the trail of a run written by 2.5.0", async () => {
    // Arrange
    ctx.seed.session(buildSessionFile({ writtenBy: "2.5.0", current: buildRun({ lane: "build", flow: "autopilot", skill: "build", trail, trailCut: true }) }));

    // Act
    const session = await only();

    // Assert
    expect(session).toMatchObject({ flow: "autopilot", skill: "build", trail, isTrailCut: true });
    expect(session).not.toHaveProperty("lane");
  });

  it("reads the lane of a run written before 2.5.0 as its flow and skill, with no trail", async () => {
    // Arrange
    ctx.seed.session(buildSessionFile({ writtenBy: "2.4.0", current: buildRun({ lane: "build", step: "stage:2" }) }));

    // Act
    const session = await only();

    // Assert
    expect(session).toMatchObject({ flow: "blueprint", skill: "build", trail: [], isTrailCut: false, step: "stage:2" });
  });

  it.each([
    ["fastlane", "fastlane", "fastlane"],
    ["autopilot", "autopilot", "autopilot"],
    ["blueprint", "blueprint", "blueprint"],
    ["review", "free", "review"],
    ["free", "free", null],
  ] as const)("reads the lane %s of an older run as flow %s and skill %s", async (lane, flow, skill) => {
    // Arrange
    ctx.seed.session(buildSessionFile({ current: buildRun({ lane }) }));

    // Act
    const session = await only();

    // Assert
    expect(session).toMatchObject({ flow, skill });
  });

  it("keeps a run that has no lane at all", async () => {
    // Arrange
    const run: Record<string, unknown> = { ...buildRun(), flow: "fastlane", skill: "fastlane" };
    delete run.lane;
    const file = { ...buildSessionFile(), runs: [run], current: run };
    ctx.seed.raw("sessions", `${file.sessionId}.json`, JSON.stringify(file));

    // Act
    const session = await only();

    // Assert
    expect(session).toMatchObject({ id: file.sessionId, flow: "fastlane", skill: "fastlane" });
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
});
