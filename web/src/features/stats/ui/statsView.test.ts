import { describe, expect, it } from "vitest";
import { barHeights, cacheSharePercent, flowLabel, isEmptyPeriod, parseFilters, writeFilters, type Stats } from "./statsView.ts";

const tokens = (input: number, cacheRead = 0, cacheWrite = 0, output = 0) => ({ input, cacheRead, cacheWrite, output });

const stats = (overrides: Partial<Stats> = {}): Stats => ({
  period: "7d",
  granularity: "day",
  from: "2026-03-04",
  to: "2026-03-10",
  totals: { calls: 0, tokens: tokens(0), sessions: 0, questions: 0 },
  undated: null,
  project: null,
  buckets: [],
  projectOptions: [],
  projects: [],
  models: [],
  flows: [],
  topSessions: [],
  ...overrides,
});

describe("parseFilters", () => {
  it("reads 7 days and every project from an empty address", () => {
    expect(parseFilters(new URLSearchParams())).toEqual({ period: "7d", project: null });
  });

  it("reads the period and the project the address keeps", () => {
    expect(parseFilters(new URLSearchParams("period=all&project=C--code-ledger"))).toEqual({ period: "all", project: "C--code-ledger" });
  });

  it("falls back to 7 days on an unknown period", () => {
    expect(parseFilters(new URLSearchParams("period=1y")).period).toBe("7d");
  });
});

describe("writeFilters", () => {
  it("leaves the default period and no project out of the address", () => {
    expect(writeFilters(new URLSearchParams("period=30d&project=x"), { period: "7d", project: null }).toString()).toBe("");
  });

  it("writes the period and the project, keeping the other parameters", () => {
    expect(writeFilters(new URLSearchParams("other=1"), { period: "90d", project: "C--a" }).toString()).toBe("other=1&period=90d&project=C--a");
  });

  it("reads back what it wrote", () => {
    const filters = { period: "30d", project: "C--code-x" } as const;
    expect(parseFilters(writeFilters(new URLSearchParams(), filters))).toEqual(filters);
  });
});

describe("cacheSharePercent", () => {
  it("gives cache read over input, cache read and cache write, in percent", () => {
    expect(cacheSharePercent(tokens(10, 80, 10, 999))).toBe(80);
  });

  it("rounds to the nearest percent", () => {
    expect(cacheSharePercent(tokens(1, 2, 0))).toBe(67);
  });

  it("gives null when nothing was read", () => {
    expect(cacheSharePercent(tokens(0, 0, 0, 50))).toBeNull();
  });
});

describe("barHeights", () => {
  it("measures each kind against the top bucket's total", () => {
    const bars = barHeights([
      { start: "2026-03-09", calls: 1, tokens: tokens(50, 50) },
      { start: "2026-03-10", calls: 2, tokens: tokens(100, 50, 25, 25) },
    ]);
    expect(bars[0]).toEqual({ start: "2026-03-09", total: 100, percent: 50, kinds: { input: 25, cacheRead: 25, cacheWrite: 0, output: 0 } });
    expect(bars[1]?.percent).toBe(100);
    expect(bars[1]?.kinds).toEqual({ input: 50, cacheRead: 25, cacheWrite: 12.5, output: 12.5 });
  });

  it("gives zero heights when every bucket is empty", () => {
    expect(barHeights([{ start: "2026-03-10", calls: 0, tokens: tokens(0) }])[0]).toEqual({ start: "2026-03-10", total: 0, percent: 0, kinds: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 } });
  });
});

describe("isEmptyPeriod", () => {
  it("is empty with no token and no call", () => {
    expect(isEmptyPeriod(stats())).toBe(true);
  });

  it("is not empty with tokens of a question, which counts no call", () => {
    expect(isEmptyPeriod(stats({ totals: { calls: 0, tokens: tokens(5), sessions: 0, questions: 1 } }))).toBe(false);
  });
});

describe("flowLabel", () => {
  it("names the types of work in French, an unknown flow as is", () => {
    expect(["free", "fastlane", "blueprint", "pilot", "questions", "undated", "someday"].map(flowLabel)).toEqual(["libre", "fastlane", "blueprint", "pilot", "Questions", "Non daté", "someday"]);
  });
});
