import { describe, expect, it } from "vitest";
import { exactTokens, formatTokens, hasDroppedPrompts, skillHowLabel, topWithRest, totalTokens, type RunUsage } from "./usage.ts";

const NARROW = " ";

describe("formatTokens", () => {
  it("writes a count under a thousand exactly", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
  });

  it("writes thousands with one decimal under 10 k, then rounded", () => {
    expect(formatTokens(1234)).toBe(`1,2${NARROW}k`);
    expect(formatTokens(9_949)).toBe(`9,9${NARROW}k`);
    expect(formatTokens(9_950)).toBe(`10${NARROW}k`);
    expect(formatTokens(34_000)).toBe(`34${NARROW}k`);
    expect(formatTokens(999_400)).toBe(`999${NARROW}k`);
  });

  it("writes millions with one decimal", () => {
    expect(formatTokens(999_500)).toBe(`1,0${NARROW}M`);
    expect(formatTokens(999_999)).toBe(`1,0${NARROW}M`);
    expect(formatTokens(1_234_567)).toBe(`1,2${NARROW}M`);
    expect(formatTokens(12_345_678)).toBe(`12,3${NARROW}M`);
  });
});

describe("exactTokens", () => {
  it("writes the exact count with French thousands separators", () => {
    expect(exactTokens(999)).toBe("999");
    expect(exactTokens(34_000)).toBe(`34${NARROW}000`);
    expect(exactTokens(1_234_567)).toBe(`1${NARROW}234${NARROW}567`);
  });
});

describe("totalTokens", () => {
  it("sums the four kinds", () => {
    expect(totalTokens({ input: 1, cacheRead: 20, cacheWrite: 300, output: 4000 })).toBe(4321);
  });
});

describe("topWithRest", () => {
  it("keeps the first five and counts the others", () => {
    expect(topWithRest([1, 2, 3, 4, 5, 6, 7])).toEqual({ shown: [1, 2, 3, 4, 5], rest: 2 });
  });

  it("leaves nothing over for five or fewer", () => {
    expect(topWithRest([1, 2])).toEqual({ shown: [1, 2], rest: 0 });
  });
});

describe("skillHowLabel", () => {
  it("names how a skill was loaded", () => {
    expect(skillHowLabel("tool")).toBe("outil");
    expect(skillHowLabel("command")).toBe("commande");
    expect(skillHowLabel("preloaded")).toBe("préchargée");
  });

  it("shows a way it does not know as the export names it", () => {
    expect(skillHowLabel("someday-new")).toBe("someday-new");
  });
});

describe("hasDroppedPrompts", () => {
  const tokens = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  const run = (prompts: number, calls: number, partial = false): RunUsage => ({
    calls,
    tokens,
    byModel: [],
    tools: [],
    skills: [],
    prompts: Array.from({ length: prompts }, () => ({ at: null, calls: 2, tokens })),
    settled: true,
    partial,
  });

  it("tells nothing for a partial run, whose slice starts mid-run", () => {
    expect(hasDroppedPrompts(run(50, 140, true))).toBe(false);
  });

  it("tells a full list whose calls fall short of the run's", () => {
    expect(hasDroppedPrompts(run(50, 140))).toBe(true);
  });

  it("tells nothing for exactly 50 prompts holding every call, or fewer than 50", () => {
    expect(hasDroppedPrompts(run(50, 100))).toBe(false);
    expect(hasDroppedPrompts(run(49, 140))).toBe(false);
  });
});
