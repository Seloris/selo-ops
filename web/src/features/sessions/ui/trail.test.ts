import { describe, expect, it } from "vitest";
import type { Session } from "../data/sessionView.ts";
import { hasTrail, lineColor, MAX_WEIGHT, skillColor, trailGroups, trailLines, waitingText, type Subagent, type TrailEntry } from "./trail.ts";

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

describe("agent lines", () => {
  it("gives a subagent its duration until its last update, until now while it works, and its step's lane", () => {
    // Arrange
    const agents = [agent(0, 9), agent(2, 1, { state: "working", task: "runner · web tests" }), agent(3, 0, { task: null, type: "Explore" })];

    // Act
    const items = trailGroups(trailLines([entry(0, "working")], T0), agents, T0 + 7 * 60_000)[0]?.agents.reverse() ?? [];

    // Assert
    expect(items.map((i) => i.durationText)).toEqual(["9 min", "5 min", "0 s"]);
    expect(items.map((i) => i.label)).toEqual(["planner · blueprint due-date", "runner · web tests", "Explore"]);
    expect(items.map((i) => i.parts)).toEqual([{ lead: "planner · ", skill: "blueprint", rest: " due-date" }, { lead: "runner · ", skill: "web", rest: " tests" }, null]);
  });
});

describe("trailGroups", () => {
  it("merges consecutive lines of the same skill, step and substep, never two apart", () => {
    // Arrange
    const lines = trailLines(
      [
        entry(0, "working", { skill: "fastlane" }),
        entry(1, "working", { skill: "fastlane", substep: "review" }),
        entry(3, "turn-ended", { skill: "fastlane", substep: "review" }),
        entry(4, "working", { skill: "fastlane", substep: "review" }),
        entry(6, "working", { skill: "fastlane", substep: "suites" }),
        entry(7, "working", { skill: "fastlane", substep: "review" }),
      ],
      T0,
    );

    // Act
    const groups = trailGroups(lines, [], T0 + 8 * 60_000);

    // Assert
    expect(groups.map((g) => [g.at, g.passages.map((l) => l.entry.phase)])).toEqual([
      [at(0), ["working"]],
      [at(1), ["working", "turn-ended", "working"]],
      [at(6), ["working"]],
      [at(7), ["working"]],
    ]);
  });

  it("keeps an iterate loop's line apart from the same label after the loop", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: "fastlane", substep: "code" }), entry(2, "working", { skill: "fastlane", substep: "tests" }), entry(3, "working", { skill: "fastlane", substep: "code" })], T0, "iterate");

    // Act / Assert
    expect(trailGroups(lines, [], T0).map((g) => g.passages.length)).toEqual([1, 1, 1]);
  });

  it("folds the run's opening line with no skill into the next group, its start kept, out of its passages", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: null }), entry(1, "working", { skill: "review" }), entry(3, "awaiting-answer", { skill: "review" })], T0);

    // Act
    const groups = trailGroups(lines, [], T0 + 5 * 60_000);

    // Assert
    expect(groups).toHaveLength(1);
    expect(groups[0]?.at).toBe(at(0));
    expect(groups[0]?.lines).toHaveLength(3);
    expect(groups[0]?.passages.map((l) => l.entry.at)).toEqual([at(1), at(3)]);
  });

  it("makes one group of a free run, every line without a skill", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: null }), entry(2, "awaiting-commit", { skill: null }), entry(4, "turn-ended", { skill: null })], T0);

    // Act
    const [group, ...rest] = trailGroups(lines, [], T0);

    // Assert
    expect(rest).toHaveLength(0);
    expect(group?.passages).toHaveLength(3);
    expect(group?.isFree).toBe(true);
  });

  it("lasts until the next group, the last one until now while it runs, until its last line once ended", () => {
    // Arrange
    const running = trailLines([entry(0, "working", { skill: "a" }), entry(3, "working", { skill: "b" }), entry(4, "awaiting-answer", { skill: "b" })], T0);
    const ended = trailLines([entry(0, "working", { skill: "b" }), entry(2, "job-done", { skill: "b" })], T0);

    // Act
    const runningGroups = trailGroups(running, [], T0 + 10 * 60_000);
    const endedGroups = trailGroups(ended, [], T0 + 10 * 60_000);

    // Assert
    expect(runningGroups.map((g) => g.durationText)).toEqual(["3 min", "7 min"]);
    expect(runningGroups.map((g) => g.gapText)).toEqual(["3 min", null]);
    expect(endedGroups.map((g) => g.durationText)).toEqual(["2 min"]);
  });

  it("gives each passage its own duration, the last until now while it runs, none once ended", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: "b" }), entry(2, "turn-ended", { skill: "b" }), entry(5, "awaiting-answer", { skill: "b" })], T0);
    const ended = trailLines([entry(0, "working", { skill: "b" }), entry(2, "turn-ended", { skill: "b" })], T0);

    // Act / Assert
    expect(trailGroups(lines, [], T0 + 6 * 60_000)[0]?.passageDurations).toEqual(["2 min", "3 min", "1 min"]);
    expect(trailGroups(ended, [], T0 + 6 * 60_000)[0]?.passageDurations).toEqual(["2 min", null]);
  });

  it("stops the last group at its last line once the session is closed, whatever that line's state", () => {
    // Arrange
    const lines = trailLines([entry(0, "working", { skill: "b" }), entry(2, "working", { skill: "b" })], T0);

    // Act
    const [group] = trailGroups(lines, [], T0 + 60 * 60_000, true);

    // Assert
    expect(group?.durationText).toBe("2 min");
    expect(group?.passageDurations).toEqual(["2 min", null]);
  });

  it("weighs a group by the square root of its span, so its rail is as long as the lines it stands for", () => {
    // Arrange: 4 min, then a group still running
    const lines = trailLines([entry(0, "working", { skill: "a" }), entry(1, "turn-ended", { skill: "a" }), entry(4, "working", { skill: "b" })], T0);

    // Act
    const [first] = trailGroups(lines, [], T0 + 5 * 60_000);

    // Assert
    expect(Math.round((first?.weight ?? 0) ** 2)).toBe(240);
  });

  it("puts each subagent under the group running when it started, newest first, an earlier one under the first group", () => {
    // Arrange
    const lines = trailLines([entry(1, "working", { skill: "pilot" }), entry(2, "turn-ended", { skill: "pilot" }), entry(5, "working", { skill: "fastlane" })], T0);
    const agents = [agent(0, 1, { task: "explorer · lane early" }), agent(2, 1, { task: "planner · blueprint a" }), agent(3, 1, { task: "implementer · build a" }), agent(5, 1, { task: "runner · web tests" })];

    // Act
    const groups = trailGroups(lines, agents, T0 + 6 * 60_000);

    // Assert
    expect(groups.map((g) => g.agents.map((a) => a.label))).toEqual([["implementer · build a", "planner · blueprint a", "explorer · lane early"], ["runner · web tests"]]);
  });

  it("keeps a run with no line but subagents out of any group", () => {
    expect(trailGroups([], [agent(0, 1)], T0)).toEqual([]);
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
