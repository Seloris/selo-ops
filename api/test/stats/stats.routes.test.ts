import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createQuestionRepository } from "../../src/features/questions/questions.repository.js";
import { statsResponseSchema, type StatsResponse } from "../../src/features/stats/stats.schema.js";
import { buildProjectFile, buildQuestion, buildRun, buildRunningStatusFile, buildRunUsage, buildSessionFile, buildTokens, buildUsage, rootKeyOf } from "../factories.js";
import { createTestContext } from "../setup.js";

// stats FR-02 to FR-09: the export's figures summed per run, per day in the browser's zone.

const NOW = "2026-03-10T12:00:00.000Z";
const PARIS = "Europe/Paris";
const OPUS = "claude-opus-5-5";
const SONNET = "claude-sonnet-5-5";
const LEDGER = rootKeyOf("C:/code/ledger-api");
const HARBOR = rootKeyOf("C:/code/harbor-mobile");

const tokens = (total: number) => buildTokens({ input: total, cacheRead: 0, cacheWrite: 0, output: 0 });
const usage = (total: number, calls = 1, model = OPUS) => buildRunUsage({ calls, tokens: tokens(total), byModel: [{ model, calls, tokens: tokens(total) }] });
const sumOf = (t: { input: number; cacheRead: number; cacheWrite: number; output: number }) => t.input + t.cacheRead + t.cacheWrite + t.output;

describe("GET /v1/stats", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await ctx.reset();
    ctx.clock.set(NOW);
  });

  const stats = async (query: Record<string, string> = {}): Promise<StatsResponse> => {
    const res = await request(ctx.app).get("/v1/stats").query({ tz: PARIS, ...query });
    expect(res.status).toBe(200);
    return statsResponseSchema.parse(res.body);
  };

  // One session of one main run, its usage as given.
  const seedRun = (since: string, total: number, overrides: Parameters<typeof buildSessionFile>[0] = {}) => {
    const current = overrides.current ?? buildRun({ since, updatedAt: since, usage: usage(total) });
    const runUsage = current.usage;
    const sessionUsage = runUsage ? buildUsage({ calls: runUsage.calls, tokens: runUsage.tokens, byModel: runUsage.byModel }) : null;
    const file = buildSessionFile({ usage: sessionUsage, ...overrides, current, runs: [current] });
    ctx.seed.session(file);
    return file;
  };

  it("gives zero totals and every day of the 7 days, today and the 6 before, on an empty export", async () => {
    // Act
    const body = await stats();

    // Assert
    expect(body.granularity).toBe("day");
    expect(body.from).toBe("2026-03-04");
    expect(body.to).toBe("2026-03-10");
    expect(body.buckets.map((b) => b.start)).toEqual(["2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"]);
    expect(body.buckets.every((b) => b.calls === 0 && sumOf(b.tokens) === 0)).toBe(true);
    expect(body.totals).toEqual({ calls: 0, tokens: tokens(0), sessions: 0, questions: 0 });
    expect(body.undated).toBeNull();
    expect(body.projects).toEqual([]);
    expect(body.topSessions).toEqual([]);
  });

  it("counts a run started at 23:30 UTC on the next day in Europe/Paris", async () => {
    // Arrange
    seedRun("2026-03-09T23:30:00.000Z", 100);

    // Act
    const body = await stats();

    // Assert
    expect(body.buckets.find((b) => b.start === "2026-03-10")?.tokens.input).toBe(100);
    expect(body.buckets.find((b) => b.start === "2026-03-09")?.tokens.input).toBe(0);
  });

  it("leaves a run started before the period out of it", async () => {
    // Arrange: 2026-03-03 is the 8th day back.
    seedRun("2026-03-03T10:00:00.000Z", 100);

    // Act
    const week = await stats();
    const month = await stats({ period: "30d" });

    // Assert
    expect(week.totals.sessions).toBe(0);
    expect(month.totals.tokens.input).toBe(100);
    expect(month.buckets).toHaveLength(30);
    expect(month.from).toBe("2026-02-09");
  });

  it("filters the whole page on one project and keeps every project with usage in the menu", async () => {
    // Arrange
    seedRun("2026-03-10T08:00:00.000Z", 100);
    seedRun("2026-03-10T09:00:00.000Z", 300, { root: "C:/code/harbor-mobile", repo: "C:/code/harbor-mobile/.git" });
    ctx.seed.project(buildProjectFile({ root: "C:/code/harbor-mobile", manifest: { name: "harbor" } }));

    // Act
    const all = await stats();
    const one = await stats({ project: LEDGER });

    // Assert
    expect(all.projects.map((p) => [p.id, p.name, sumOf(p.tokens), p.sessions])).toEqual([
      [HARBOR, "harbor", 300, 1],
      [LEDGER, "ledger-api", 100, 1],
    ]);
    expect(one.totals.tokens.input).toBe(100);
    expect(one.projects.map((p) => p.id)).toEqual([LEDGER]);
    expect(one.topSessions).toHaveLength(1);
    expect(one.project).toEqual({ id: LEDGER, name: "ledger-api" });
    expect(all.project).toBeNull();
    expect(one.projectOptions).toEqual([
      { id: HARBOR, name: "harbor" },
      { id: LEDGER, name: "ledger-api" },
    ]);
  });

  it("names the project asked even in a period where it has no usage", async () => {
    // Arrange
    ctx.seed.project(buildProjectFile({ root: "C:/code/harbor-mobile", manifest: { name: "harbor" } }));

    // Act
    const body = await stats({ project: HARBOR });

    // Assert
    expect(body.project).toEqual({ id: HARBOR, name: "harbor" });
    expect(body.projectOptions).toEqual([]);
  });

  it("counts the part of a session's usage the export keeps no run for only under all, floored at zero", async () => {
    // Arrange: the session's totals hold 900 more input tokens and 4 more calls than its one run, but fewer output tokens.
    const run = usage(100, 2);
    run.tokens.output = 50;
    run.byModel = [{ model: OPUS, calls: 2, tokens: { ...tokens(100), output: 50 } }];
    const current = buildRun({ since: "2026-03-10T08:00:00.000Z", usage: run });
    const total = { input: 1000, cacheRead: 0, cacheWrite: 0, output: 10 };
    ctx.seed.session(buildSessionFile({ current, runs: [current], usage: buildUsage({ calls: 6, tokens: total, byModel: [{ model: OPUS, calls: 6, tokens: total }] }) }));

    // Act
    const week = await stats();
    const all = await stats({ period: "all" });

    // Assert
    expect(week.undated).toBeNull();
    expect(week.totals.tokens).toEqual({ input: 100, cacheRead: 0, cacheWrite: 0, output: 50 });
    expect(all.undated).toEqual({ calls: 4, tokens: { input: 900, cacheRead: 0, cacheWrite: 0, output: 0 } });
    expect(all.totals.calls).toBe(6);
    expect(all.totals.tokens.input).toBe(1000);
    expect(all.flows.find((f) => f.flow === "undated")?.tokens.input).toBe(900);
    expect(all.models).toEqual([{ model: OPUS, calls: 6, tokens: { input: 1000, cacheRead: 0, cacheWrite: 0, output: 50 } }]);
    expect(sumOf(all.buckets.reduce((t, b) => ({ ...t, input: t.input + b.tokens.input }), tokens(0)))).toBe(100);
  });

  it("counts a subagent's tokens under the flow of the main run it ran under", async () => {
    // Arrange
    const first = buildRun({ flow: "fastlane", since: "2026-03-10T08:00:00.000Z", usage: usage(10) });
    const second = buildRun({ flow: "pilot", mode: "autonomous", since: "2026-03-10T09:00:00.000Z", usage: usage(20) });
    const underFirst = buildRun({ agentId: "a-1", since: "2026-03-10T08:30:00.000Z", usage: usage(100) });
    const underSecond = buildRun({ agentId: "a-2", since: "2026-03-10T09:30:00.000Z", usage: usage(1000) });
    const orphan = buildRun({ agentId: "a-3", since: "2026-03-10T07:00:00.000Z", usage: usage(5) });
    ctx.seed.session(buildSessionFile({ current: second, runs: [orphan, underSecond, second, underFirst, first], usage: null }));

    // Act
    const body = await stats();

    // Assert
    const flow = (name: string) => body.flows.find((f) => f.flow === name)?.tokens.input;
    expect(flow("fastlane")).toBe(110);
    expect(flow("pilot")).toBe(1020);
    expect(flow("free")).toBe(5);
    expect(body.totals.calls).toBe(5);
  });

  it("counts the answered questions with tokens, in their project and as their own type of work", async () => {
    // Arrange: a question is asked of a project the export lists.
    ctx.seed.project(buildProjectFile());
    const questions = createQuestionRepository(ctx.db);
    await questions.insert(buildQuestion({ askedAt: new Date("2026-03-09T10:00:00.000Z"), inputTokens: 7, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 3 }));
    await questions.insert(buildQuestion({ inputTokens: null, cacheReadTokens: null, cacheWriteTokens: null, outputTokens: null, askedAt: new Date("2026-03-09T10:00:00.000Z") }));
    await questions.insert(buildQuestion({ state: "failed", askedAt: new Date("2026-03-09T10:00:00.000Z") }));
    await questions.insert(buildQuestion({ askedAt: new Date("2026-02-01T10:00:00.000Z") }));

    // Act
    const body = await stats();

    // Assert
    expect(body.totals.questions).toBe(1);
    expect(body.totals.sessions).toBe(0);
    expect(body.totals.tokens).toEqual({ input: 7, cacheRead: 0, cacheWrite: 0, output: 3 });
    expect(body.flows).toEqual([{ flow: "questions", calls: 0, tokens: { input: 7, cacheRead: 0, cacheWrite: 0, output: 3 } }]);
    expect(body.models.map((m) => m.model)).toEqual([SONNET]);
    expect(body.projects.map((p) => [p.id, p.name])).toEqual([[LEDGER, "ledger-api"]]);
    expect(body.buckets.find((b) => b.start === "2026-03-09")?.tokens.input).toBe(7);
  });

  it("leaves out the sessions outside selo and those whose transcript is gone", async () => {
    // Arrange
    seedRun("2026-03-10T08:00:00.000Z", 100, { transcriptPath: "C:/nowhere/gone.jsonl" });
    ctx.seed.running(buildRunningStatusFile());

    // Act
    const body = await stats();

    // Assert
    expect(body.totals.sessions).toBe(0);
    expect(body.topSessions).toEqual([]);
  });

  it("splits the tokens per model, most first, and leaves calls with no model in the totals only", async () => {
    // Arrange
    const run = buildRunUsage({
      calls: 6,
      tokens: tokens(700),
      byModel: [
        { model: SONNET, calls: 2, tokens: tokens(200) },
        { model: OPUS, calls: 3, tokens: tokens(450) },
      ],
    });
    seedRun("2026-03-10T08:00:00.000Z", 0, { current: buildRun({ since: "2026-03-10T08:00:00.000Z", usage: run }), usage: null });

    // Act
    const body = await stats();

    // Assert
    expect(body.models.map((m) => [m.model, m.calls, m.tokens.input])).toEqual([
      [OPUS, 3, 450],
      [SONNET, 2, 200],
    ]);
    expect(body.totals.tokens.input).toBe(700);
  });

  it("lists the 10 sessions with the most tokens, most first", async () => {
    // Arrange
    for (let i = 1; i <= 12; i += 1) seedRun("2026-03-10T08:00:00.000Z", i * 10, { current: buildRun({ request: `Request ${i}`, flow: "blueprint", since: "2026-03-10T08:00:00.000Z", usage: usage(i * 10) }) });

    // Act
    const body = await stats();

    // Assert
    expect(body.topSessions).toHaveLength(10);
    expect(body.topSessions.map((s) => s.request)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((i) => `Request ${i}`));
    expect(body.topSessions[0]).toMatchObject({ projectId: LEDGER, projectName: "ledger-api", flow: "blueprint", model: OPUS, calls: 1 });
    expect(body.totals.sessions).toBe(12);
  });

  it("gives one bar per week starting on Monday under all beyond 90 days", async () => {
    // Arrange: 2025-11-05 is a Wednesday, 125 days before today (a Tuesday).
    seedRun("2025-11-05T10:00:00.000Z", 100);
    seedRun("2026-03-10T10:00:00.000Z", 50);

    // Act
    const body = await stats({ period: "all" });

    // Assert
    expect(body.granularity).toBe("week");
    expect(body.from).toBe("2025-11-03");
    expect(body.buckets[0]).toMatchObject({ start: "2025-11-03", calls: 1 });
    expect(body.buckets.at(-1)).toMatchObject({ start: "2026-03-09" });
    expect(body.buckets.at(-1)?.tokens.input).toBe(50);
    expect(body.buckets).toHaveLength(19);
  });

  it("keeps days under all within 90 days", async () => {
    // Arrange
    seedRun("2026-03-01T10:00:00.000Z", 100);

    // Act
    const body = await stats({ period: "all" });

    // Assert
    expect(body.granularity).toBe("day");
    expect(body.from).toBe("2026-03-01");
    expect(body.buckets).toHaveLength(10);
  });

  it("answers 400 to an unknown period or time zone", async () => {
    // Act
    const period = await request(ctx.app).get("/v1/stats").query({ period: "1y" });
    const zone = await request(ctx.app).get("/v1/stats").query({ tz: "Mars/Olympus" });

    // Assert
    expect(period.status).toBe(400);
    expect(zone.status).toBe(400);
    expect(zone.headers["content-type"]).toContain("application/problem+json");
  });
});
