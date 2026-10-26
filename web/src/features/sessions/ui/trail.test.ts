import { describe, expect, it } from "vitest";
import type { Session } from "../data/sessionView.ts";
import { hasTrail, lineColor, MAX_WEIGHT, skillColor, timelineItems, trailLines, waitingText, type Subagent, type TrailEntry } from "./trail.ts";

describe("skillColor", () => {
  it("colours the lane skills, build as a blueprint, mockup as its flow, and leaves the others neutral", () => {
    // Act
    const colors = ["fastlane", "blueprint", "build", "pilot", "mockup", "review", null].map(skillColor);

    // Assert
    expect(colors).toEqual(["var(--lane-fastlane)", "var(--lane-blueprint)", "var(--lane-blueprint)", "var(--lane-pilot)", "var(--lane-mockup)", undefined, undefined]);
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
    const iterate = trailLines(trail, T0, "iterate");
    const plain = trailLines(trail, T0);

    // Assert
    expect(iterate.map(lineColor)).toEqual(["var(--lane-iterate)", "var(--lane-iterate)", "var(--lane-fastlane)", "var(--lane-fastlane)"]);
    expect(plain.map((l) => l.isLoop)).toEqual([false, false, false, false]);
  });

  it("marks past working lines only, never a wait nor the last line", () => {
    // Arrange
    const trail = [entry(0, "working"), entry(3, "awaiting-answer"), entry(5, "working"), entry(9, "working")];

    // Act
    const lines = trailLines(trail, T0);

    // Assert
    expect(lines.map((l) => l.isPastWork)).toEqual([true, false, true, false]);
  });

  it("gives each line how long it lasted until the next, none on the last", () => {
    // Arrange
    const trail = [entry(0, "working"), entry(3, "awaiting-commit"), entry(9, "working")];

    // Act
    const lines = trailLines(trail, T0);

    // Assert
    expect(lines.map((l) => l.durationText)).toEqual(["3 min", "6 min", null]);
  });

  it("weighs each line by the square root of its seconds, the last one running until now", () => {
    // Arrange: 1 min, then 4 min, then 9 min still running
    const trail = [entry(0, "working"), entry(1, "turn-ended"), entry(5, "working")];

    // Act
    const lines = trailLines(trail, T0 + 14 * 60_000);

    // Assert
    expect(lines.map((l) => Math.round(l.weight ** 2))).toEqual([60, 240, 540]);
  });

  it("caps the weight, so a turn ended a day ago does not swallow the ribbon", () => {
    expect(trailLines([entry(0, "turn-ended")], T0 + 24 * 3_600_000)[0]?.weight).toBe(MAX_WEIGHT);
  });

  it("never gives a negative weight to a line dated after now", () => {
    expect(trailLines([entry(5, "working")], T0)[0]?.weight).toBe(0);
  });

  it("names the step and substep like the row does", () => {
    // Act
    const [line] = trailLines([entry(0, "working", { step: "stage:2", substep: "tests" })], T0);

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

describe("timelineItems", () => {
  it("places each subagent at its start among the run's lines, a run line first on a tie", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: "pilot" }), entry(1, "turn-ended", { skill: "pilot" }), entry(10, "working", { skill: "pilot" })], T0);
    const agents = [agent(10, 2, { task: "implementer · build due-date" }), agent(1, 8)];

    // Act
    const items = timelineItems(lines, agents, T0);

    // Assert
    expect(items.map((i) => i.line?.entry.phase ?? i.agent?.label)).toEqual(["working", "turn-ended", "planner · blueprint due-date", "working", "implementer · build due-date"]);
  });

  it("gives each item the time until the next, in the colour of the run's line in force", () => {
    // Arrange
    const lines = trailLines([entry(0, "working"), entry(4, "turn-ended")], T0);

    // Act
    const items = timelineItems(lines, [agent(1, 9)], T0 + 9 * 60_000);

    // Assert
    expect(items.map((i) => i.gapText)).toEqual(["1 min", "3 min", null]);
    expect(items.map((i) => i.runLine?.entry.phase)).toEqual(["working", "working", "turn-ended"]);
    expect(Math.round((items[2]?.weight ?? 0) ** 2)).toBe(300);
  });

  it("gives a subagent its duration until its last update, until now while it works, and its step's lane", () => {
    // Arrange
    const agents = [agent(0, 9), agent(2, 1, { state: "working", task: "runner · web tests" }), agent(3, 0, { task: null, type: "Explore" })];

    // Act
    const items = timelineItems([], agents, T0 + 7 * 60_000);

    // Assert
    expect(items.map((i) => i.agent?.durationText)).toEqual(["9 min", "5 min", "0 s"]);
    expect(items.map((i) => i.agent?.label)).toEqual(["planner · blueprint due-date", "runner · web tests", "Explore"]);
    expect(items.map((i) => i.agent?.parts)).toEqual([{ lead: "planner · ", skill: "blueprint", rest: " due-date" }, { lead: "runner · ", skill: "web", rest: " tests" }, null]);
  });
});

describe("waitingText", () => {
  it("sums the ended waits on an answer and on a commit", () => {
    // Arrange
    const trail = [
      entry(0, "working"),
      entry(2, "awaiting-answer"),
      entry(4, "working"),
      entry(10, "awaiting-commit"),
      entry(14, "working"),
      entry(20, "stopped"),
    ];

    // Act / Assert
    expect(waitingText(trail)).toBe("6 min à t’attendre");
  });

  it("leaves out a wait still open", () => {
    expect(waitingText([entry(0, "working"), entry(2, "awaiting-commit")])).toBeNull();
  });

  it("says nothing when the run never waited on the person", () => {
    expect(waitingText([entry(0, "working"), entry(5, "job-done")])).toBeNull();
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
