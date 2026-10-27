import { describe, expect, it } from "vitest";
import type { Session } from "../data/sessionView.ts";
import { currentRunSince, earlierRuns, hasTrail, lineColor, skillColor, spanText, trailChapters, trailLines, trailPath, type Subagent, type TrailEntry, type TrailRun } from "./trail.ts";

describe("skillColor", () => {
  it("colours the lane skills, build as a blueprint, mockup as its flow, and leaves the others neutral", () => {
    // Act
    const colors = ["fastlane", "blueprint", "build", "pilot", "mockup", "review", null].map(skillColor);

    // Assert
    expect(colors).toEqual(["var(--lane-fastlane)", "var(--lane-blueprint)", "var(--lane-blueprint)", "var(--lane-pilot)", "var(--lane-mockup)", undefined, undefined]);
  });
});

describe("spanText", () => {
  it("reads a span under an hour to the second, an hour or more as an age", () => {
    expect([30_000, 120_000, 330_000, 100_000, 3_600_000, 5_400_000].map(spanText)).toEqual(["30 s", "2 min", "5 min 30", "1 min 40", "1 h", "1 h 30"]);
  });

  it("never reads a negative span", () => {
    expect(spanText(-5_000)).toBe("0 s");
  });
});

const T0 = Date.parse("2026-10-23T09:00:00.000Z");
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();
const entry = (minutes: number, phase: TrailEntry["phase"], overrides: Partial<TrailEntry> = {}): TrailEntry => ({
  at: at(minutes),
  skill: "build",
  step: null,
  substep: null,
  phase,
  ...overrides,
});

describe("trailLines", () => {
  it("colours an iterate fastlane's loop orange, up to its end's first mark past code", () => {
    // Arrange
    const trail = [
      entry(0, "working", { skill: "fastlane" }),
      entry(2, "awaiting-answer", { skill: "fastlane", substep: "code" }),
      entry(6, "working", { skill: "fastlane", substep: "tests" }),
      entry(9, "working", { skill: "fastlane", substep: "code" }),
    ];

    // Act
    const iterate = trailLines(trail, "iterate");
    const plain = trailLines(trail);

    // Assert
    expect(iterate.map(lineColor)).toEqual(["var(--lane-iterate)", "var(--lane-iterate)", "var(--lane-fastlane)", "var(--lane-fastlane)"]);
    expect(plain.map((l) => l.isLoop)).toEqual([false, false, false, false]);
  });

  it("marks past working lines only, never a wait nor the last line", () => {
    // Arrange
    const trail = [entry(0, "working"), entry(3, "awaiting-answer"), entry(5, "working"), entry(9, "working")];

    // Act
    const lines = trailLines(trail);

    // Assert
    expect(lines.map((l) => l.isPastWork)).toEqual([true, false, true, false]);
  });

  it("gives each line how long it lasted until the next, to the second, none on the last", () => {
    // Arrange
    const trail = [entry(0, "working"), entry(2.5, "awaiting-commit"), entry(9, "working")];

    // Act
    const lines = trailLines(trail);

    // Assert
    expect(lines.map((l) => l.durationText)).toEqual(["2 min 30", "6 min 30", null]);
    expect(lines.map((l) => l.durationMs)).toEqual([150_000, 390_000, null]);
  });

  it("names the step and substep like the row does", () => {
    // Act
    const [line] = trailLines([entry(0, "working", { step: "stage:2", substep: "tests" })]);

    // Assert
    expect(line?.stepText).toBe("Étape 2 · tests");
  });
});

const agent = (minutes: number, lasted: number, overrides: Partial<Subagent> = {}): Subagent => ({
  type: "general-purpose",
  task: "planner · blueprint due-date",
  state: "job-done",
  since: at(minutes),
  updatedAt: at(minutes + lasted),
  model: null,
  usage: null,
  ...overrides,
});

describe("agent lines", () => {
  it("gives a subagent its duration until its last update, until now while it works, and its step's lane", () => {
    // Arrange
    const agents = [agent(0, 9), agent(2, 1, { state: "working", task: "runner · web tests" }), agent(3, 0, { task: null, type: "Explore" })];

    // Act
    const items = trailChapters(trailLines([entry(0, "working")]), agents, T0 + 7 * 60_000).chapters[0]?.agents ?? [];

    // Assert
    expect(items.map((i) => i.durationText)).toEqual(["9 min", "5 min", "0 s"]);
    expect(items.map((i) => i.label)).toEqual(["planner · blueprint due-date", "runner · web tests", "Explore"]);
    expect(items.map((i) => i.parts)).toEqual([{ lead: "planner · ", skill: "blueprint", rest: " due-date" }, { lead: "runner · ", skill: "web", rest: " tests" }, null]);
  });
});

describe("trailChapters", () => {
  it("makes one chapter of consecutive lines of the same skill and step, whatever their substep and state", () => {
    // Arrange
    const lines = trailLines([
      entry(0, "working", { skill: "fastlane" }),
      entry(1, "working", { skill: "fastlane", substep: "review" }),
      entry(3, "awaiting-commit", { skill: "fastlane", substep: "commit" }),
      entry(4, "working", { skill: "build", step: "stage:1", substep: "tests" }),
      entry(6, "working", { skill: "build", step: "stage:1", substep: "code" }),
      entry(7, "working", { skill: "build", step: "stage:2", substep: "tests" }),
    ]);

    // Act
    const { chapters } = trailChapters(lines, [], T0 + 8 * 60_000);

    // Assert
    expect(chapters.map((c) => [c.at, c.passages.map((l) => l.entry.substep)])).toEqual([
      [at(0), [null, "review", "commit"]],
      [at(4), ["tests", "code"]],
      [at(7), ["tests"]],
    ]);
  });

  it("keeps an iterate loop's lines apart from the same skill after the loop", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: "fastlane", substep: "code" }), entry(2, "working", { skill: "fastlane", substep: "tests" })], "iterate");

    // Act / Assert
    expect(trailChapters(lines, [], T0).chapters.map((c) => c.passages.length)).toEqual([1, 1]);
  });

  it("folds the run's opening line with no skill into the next chapter, its start kept, out of its passages", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: null }), entry(1, "working", { skill: "review" }), entry(3, "awaiting-answer", { skill: "review" })]);

    // Act
    const { chapters } = trailChapters(lines, [], T0 + 5 * 60_000);

    // Assert
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.at).toBe(at(0));
    expect(chapters[0]?.lines).toHaveLength(3);
    expect(chapters[0]?.passages.map((l) => l.entry.at)).toEqual([at(1), at(3)]);
  });

  it("makes one free chapter of a run whose lines all lack a skill", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: null }), entry(2, "awaiting-commit", { skill: null }), entry(4, "turn-ended", { skill: null })]);

    // Act
    const { chapters } = trailChapters(lines, [], T0);

    // Assert
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.passages).toHaveLength(3);
    expect(chapters[0]?.isFree).toBe(true);
  });

  it("lasts until the next chapter, the last one until now while the run goes on, until its last line once ended", () => {
    // Arrange
    const running = trailLines([entry(0, "working", { skill: "a" }), entry(3, "working", { skill: "b" }), entry(4, "awaiting-answer", { skill: "b" })]);
    const ended = trailLines([entry(0, "working", { skill: "b" }), entry(2, "job-done", { skill: "b" })]);

    // Act
    const runningTrail = trailChapters(running, [], T0 + 10 * 60_000);
    const endedTrail = trailChapters(ended, [], T0 + 10 * 60_000);

    // Assert
    expect(runningTrail.chapters.map((c) => c.durationText)).toEqual(["3 min", "7 min"]);
    expect(runningTrail.isRunning).toBe(true);
    expect(runningTrail.durationText).toBe("10 min");
    expect(endedTrail.chapters.map((c) => c.durationText)).toEqual(["2 min"]);
    expect(endedTrail.isRunning).toBe(false);
    expect(endedTrail.durationText).toBe("2 min");
  });

  it("gives each passage its own duration, the last until now while the run goes on, none once ended", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: "b" }), entry(2, "turn-ended", { skill: "b" }), entry(5, "awaiting-answer", { skill: "b" })]);
    const ended = trailLines([entry(0, "working", { skill: "b" }), entry(2, "turn-ended", { skill: "b" })]);
    const durations = (c: ReturnType<typeof trailChapters>["chapters"][number] | undefined) => c?.items.map((i) => (i.kind === "passage" ? i.durationText : null));

    // Act / Assert
    expect(durations(trailChapters(lines, [], T0 + 6 * 60_000).chapters[0])).toEqual(["2 min", "3 min", "1 min"]);
    expect(durations(trailChapters(ended, [], T0 + 6 * 60_000).chapters[0])).toEqual(["2 min", null]);
  });

  it("stops the last chapter at its last line once the session is closed, whatever that line's state", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: "b" }), entry(2, "working", { skill: "b" })]);

    // Act
    const trail = trailChapters(lines, [], T0 + 60 * 60_000, true);

    // Assert
    expect(trail.isRunning).toBe(false);
    expect(trail.chapters[0]?.durationText).toBe("2 min");
    expect(trail.chapters[0]?.isLive).toBe(false);
  });

  it("marks the chapter in progress: the last one, its last line working, while the run goes on", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: "a" }), entry(1, "working", { skill: "b" })]);
    const waiting = trailLines([entry(0, "working", { skill: "b" }), entry(1, "awaiting-answer", { skill: "b" })]);

    // Act / Assert
    expect(trailChapters(lines, [], T0 + 2 * 60_000).chapters.map((c) => c.isLive)).toEqual([false, true]);
    expect(trailChapters(waiting, [], T0 + 2 * 60_000).chapters.map((c) => c.isLive)).toEqual([false]);
  });

  it("sums a chapter's ended waits on the person and counts its round trips", () => {
    // Arrange
    const lines = trailLines([
      entry(0, "working", { skill: "mockup" }),
      entry(3, "awaiting-answer", { skill: "mockup" }),
      entry(5, "working", { skill: "mockup" }),
      entry(6, "awaiting-commit", { skill: "mockup" }),
      entry(7, "working", { skill: "build" }),
      entry(8, "awaiting-answer", { skill: "build" }),
    ]);

    // Act
    const trail = trailChapters(lines, [], T0 + 10 * 60_000);

    // Assert
    expect(trail.chapters.map((c) => c.waitingText)).toEqual(["3 min à t’attendre", null]);
    expect(trail.chapters.map((c) => c.roundTrips)).toEqual([1, 1]);
    expect(trail.waitingText).toBe("3 min à t’attendre");
  });

  it("leaves an open wait out of the waits, and says nothing when the run never waited", () => {
    // Arrange
    const open = trailLines([entry(0, "working"), entry(2, "awaiting-commit")]);
    const never = trailLines([entry(0, "working"), entry(5, "job-done")]);

    // Act / Assert
    expect(trailChapters(open, [], T0 + 5 * 60_000).waitingText).toBeNull();
    expect(trailChapters(never, [], T0 + 5 * 60_000).waitingText).toBeNull();
  });

  it("puts each subagent under the chapter running when it started, oldest first, an earlier one under the first chapter", () => {
    // Arrange
    const lines = trailLines([entry(1, "working", { skill: "pilot" }), entry(2, "turn-ended", { skill: "pilot" }), entry(5, "working", { skill: "fastlane" })]);
    const agents = [agent(3, 1, { task: "implementer · build a" }), agent(0, 1, { task: "explorer · lane early" }), agent(2, 1, { task: "planner · blueprint a" }), agent(5, 1, { task: "runner · web tests" })];

    // Act
    const { chapters } = trailChapters(lines, agents, T0 + 6 * 60_000);

    // Assert
    expect(chapters.map((c) => c.agents.map((a) => a.label))).toEqual([["explorer · lane early", "planner · blueprint a", "implementer · build a"], ["runner · web tests"]]);
  });

  it("lists a chapter's passages and subagents by time, a passage first at the same time", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: "blueprint" }), entry(2, "awaiting-commit", { skill: "blueprint" }), entry(4, "working", { skill: "blueprint" })]);
    const agents = [agent(1, 1, { task: "reviewer · blueprint" }), agent(2, 1, { task: "runner · spec check" })];

    // Act
    const items = trailChapters(lines, agents, T0 + 5 * 60_000).chapters[0]?.items ?? [];

    // Assert
    expect(items.map((i) => (i.kind === "passage" ? `p ${i.line.entry.phase}` : `a ${i.agent.label}`))).toEqual(["p working", "a reviewer · blueprint", "p awaiting-commit", "a runner · spec check", "p working"]);
  });

  it("keeps a run with no line but subagents out of any chapter", () => {
    expect(trailChapters([], [agent(0, 1)], T0)).toEqual({ chapters: [], isRunning: false, durationText: null, waitingText: null });
  });
});

describe("trailPath", () => {
  it("reads the chapters' skills once each in a row, a free run as « libre », the lane colours kept", () => {
    // Arrange
    const lines = trailLines([
      entry(0, "working", { skill: null }),
      entry(1, "working", { skill: "pilot" }),
      entry(2, "working", { skill: "build", step: "stage:1" }),
      entry(3, "awaiting-commit", { skill: "build", step: "stage:1" }),
      entry(4, "working", { skill: "build", step: "stage:2" }),
      entry(5, "working", { skill: "review" }),
    ]);
    const free = trailLines([entry(0, "working", { skill: null }), entry(1, "awaiting-answer", { skill: null })]);

    // Act
    const path = trailPath(trailChapters(lines, [], T0 + 6 * 60_000).chapters);
    const freePath = trailPath(trailChapters(free, [], T0 + 6 * 60_000).chapters);

    // Assert
    expect(path.map((p) => [p.label, p.color])).toEqual([
      ["pilot", "var(--lane-pilot)"],
      ["build", "var(--lane-blueprint)"],
      ["review", undefined],
    ]);
    expect(freePath).toEqual([{ label: "libre", color: "var(--lane-free)" }]);
  });
});

describe("hasTrail", () => {
  const session = (overrides: Partial<Session>) => ({ isOutsideSelo: false, trail: [entry(0, "working")], ...overrides }) as Session;

  it("shows the section for a session with a trail", () => {
    expect(hasTrail(session({}))).toBe(true);
  });

  it("leaves the section out with an empty trail (an export older than 2.5.0)", () => {
    expect(hasTrail(session({ trail: [] }))).toBe(false);
  });

  it("leaves the section out for a session outside selo", () => {
    expect(hasTrail(session({ isOutsideSelo: true }))).toBe(false);
  });
});

describe("earlierRuns", () => {
  const run = (overrides: Partial<TrailRun> = {}): TrailRun => ({
    since: at(0),
    request: "Ajoute un filtre",
    isRequestCut: false,
    isRequestImage: false,
    mode: null,
    trail: [entry(0, "turn-ended")],
    isTrailCut: false,
    subagents: [],
    ...overrides,
  });

  const session = { isOutsideSelo: false, runs: [{ since: at(3), request: "", isRequestCut: false, isRequestImage: false, usage: null }], trail: [] };

  it("keeps the earlier prompts with a history, oldest first", () => {
    // Arrange
    const runs = [run({ request: "a" }), run({ request: "b", trail: [] }), run({ request: "c", since: at(1) })];

    // Act
    const earlier = earlierRuns(session, runs);

    // Assert
    expect(earlier.map((r) => r.request)).toEqual(["a", "c"]);
  });

  it("gives none for a session outside selo, nor before the history is read", () => {
    expect(earlierRuns({ ...session, isOutsideSelo: true }, [run()])).toEqual([]);
    expect(earlierRuns(session, undefined)).toEqual([]);
  });

  it("never gives a prompt that started with the current one or after", () => {
    // Arrange
    const runs = [run({ request: "a" }), run({ request: "b", since: at(3) }), run({ request: "c", since: at(4) })];

    // Act
    const earlier = earlierRuns(session, runs);

    // Assert
    expect(earlier.map((r) => r.request)).toEqual(["a"]);
  });

  it("starts the current prompt at the latest run's start, else at its first line kept", () => {
    // Arrange
    const trail = [entry(5, "working"), entry(9, "working")];
    const listed = { since: at(1), request: "", isRequestCut: false, isRequestImage: false, usage: null };

    // Act
    const starts = [currentRunSince({ runs: [{ ...listed, since: at(0) }, listed], trail }), currentRunSince({ runs: [], trail })];

    // Assert
    expect(starts).toEqual([at(1), at(5)]);
  });
});
