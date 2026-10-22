import { describe, expect, it } from "vitest";
import { cacheReuse, exactTokens, formatTokens, hasDroppedPrompts, kindShares, percentText, runRequestText, runTimeText, skillHowLabel, topWithRest, totalTokens, widthPercent, type RunUsage } from "./usage.ts";

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

describe("kindShares", () => {
  it("gives each kind's count and share of the total", () => {
    const shares = kindShares({ input: 10, cacheRead: 70, cacheWrite: 0, output: 20 });
    expect(shares.map((s) => s.kind)).toEqual(["input", "cacheRead", "cacheWrite", "output"]);
    expect(shares.map((s) => s.ratio)).toEqual([0.1, 0.7, 0, 0.2]);
  });

  it("gives no share for an empty total", () => {
    expect(kindShares({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }).every((s) => s.ratio === 0)).toBe(true);
  });
});

describe("cacheReuse", () => {
  it("is the cache read over everything read, output left out", () => {
    expect(cacheReuse({ input: 10, cacheRead: 80, cacheWrite: 10, output: 5000 })).toBe(0.8);
  });

  it("is null when nothing was read", () => {
    expect(cacheReuse({ input: 0, cacheRead: 0, cacheWrite: 0, output: 12 })).toBeNull();
  });
});

describe("percentText", () => {
  it("rounds to a whole percent with a narrow space", () => {
    expect(percentText(0.874)).toBe(`87${NARROW}%`);
    expect(percentText(1)).toBe(`100${NARROW}%`);
    expect(percentText(0)).toBe(`0${NARROW}%`);
  });

  it("marks a share under one percent", () => {
    expect(percentText(0.003)).toBe(`< 1${NARROW}%`);
  });
});

describe("widthPercent", () => {
  it("scales against the largest, and is zero when that is zero", () => {
    expect(widthPercent(25, 100)).toBe(25);
    expect(widthPercent(5, 0)).toBe(0);
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

describe("runTimeText", () => {
  const now = new Date(2026, 9, 23, 10, 0).getTime();

  it("writes the time alone for a run of today", () => {
    expect(runTimeText(new Date(2026, 9, 23, 0, 54).toISOString(), now)).toBe("00:54");
  });

  it("adds the day for a run of another day, and the year for another year", () => {
    expect(runTimeText(new Date(2026, 9, 22, 22, 30).toISOString(), now)).toBe("22 oct. 22:30");
    expect(runTimeText(new Date(2025, 11, 31, 9, 5).toISOString(), now)).toBe("31 déc. 2025 09:05");
  });
});

describe("runRequestText", () => {
  const run = (request: string, isRequestCut = false) => ({ since: "2026-10-22T22:30:00.000Z", request, isRequestCut, usage: null });

  it("writes the request, with « … » when the export cut it", () => {
    expect(runRequestText(run("fait un .bat stp"))).toBe("fait un .bat stp");
    expect(runRequestText(run("x".repeat(200), true))).toBe(`${"x".repeat(200)}…`);
  });

  it("says an empty request is unreadable", () => {
    expect(runRequestText(run(""))).toBe("Demande non lisible dans l’export");
  });
});
