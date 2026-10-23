import { describe, expect, it } from "vitest";
import type { Session } from "../data/sessionView.ts";
import { hasTrail, MAX_WEIGHT, trailLines, waitingText, type TrailEntry } from "./trail.ts";

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
