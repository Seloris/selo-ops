import { describe, expect, it } from "vitest";
import { cacheReuse, exactTokens, formatTokens, hasDroppedPrompts, kindShares, listsRuns, percentText, runRequestText, runTimeText, sessionActivity, skillHowLabel, soleModel, topWithRest, totalTokens, usageSummary, widthPercent, type RunUsage, type SessionRun } from "./usage.ts";

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
  const run = (request: string, isRequestCut = false, isRequestImage = false) => ({
    since: "2026-10-22T22:30:00.000Z",
    request,
    isRequestCut,
    isRequestImage,
    usage: null,
  });

  it("writes the request, with « … » when the export cut it", () => {
    expect(runRequestText(run("fait un .bat stp"))).toBe("fait un .bat stp");
    expect(runRequestText(run("x".repeat(200), true))).toBe(`${"x".repeat(200)}…`);
  });

  it("says an empty request is unreadable", () => {
    expect(runRequestText(run(""))).toBe("Demande non lisible dans l’export");
  });

  it("says an empty request whose prompt is an image alone", () => {
    expect(runRequestText(run("", false, true))).toBe("Image seule, sans texte");
  });
});

describe("soleModel", () => {
  const tokens = { input: 1, cacheRead: 2, cacheWrite: 3, output: 4 };
  it("names the model when there is one only", () => {
    expect(soleModel({ tokens, calls: 1, byModel: [{ model: "m1", tokens, calls: 1 }] } as never)).toBe("m1");
  });
  it("returns null for several models or none", () => {
    expect(soleModel({ tokens, calls: 2, byModel: [{ model: "m1", tokens, calls: 1 }, { model: "m2", tokens, calls: 1 }] } as never)).toBeNull();
    expect(soleModel({ tokens, calls: 0, byModel: [] } as never)).toBeNull();
  });
});

describe("listsRuns", () => {
  const tokens = { input: 1, cacheRead: 2, cacheWrite: 3, output: 4 };
  const session = { tokens, calls: 1, byModel: [] } as never;
  const run = (usage: unknown) => ({ since: "2026-10-23T01:10:00Z", usage }) as never;
  it("lists the runs when there are several", () => {
    expect(listsRuns([run(null), run(null)], false, session)).toBe(true);
  });
  it("skips a single run whose tokens are the session's", () => {
    expect(listsRuns([run({ tokens })], false, session)).toBe(false);
    expect(listsRuns([], false, session)).toBe(false);
  });
  it("skips a single run when the session has no usage", () => {
    expect(listsRuns([run(null)], false, null)).toBe(false);
  });
  it("lists a single run that differs from the session or has no usage", () => {
    expect(listsRuns([run({ tokens: { ...tokens, output: 9 } })], false, session)).toBe(true);
    expect(listsRuns([run(null)], false, session)).toBe(true);
  });
  it("lists a single run when the export cut the list", () => {
    expect(listsRuns([run({ tokens })], true, session)).toBe(true);
  });
});

describe("sessionActivity", () => {
  const tokens = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  const run = (tools: RunUsage["tools"], skills: RunUsage["skills"]) =>
    ({ since: "2026-10-23T01:10:00Z", request: "", isRequestCut: false, isRequestImage: false, usage: { calls: 1, tokens, byModel: [], tools, skills, prompts: [], settled: true, partial: false } }) as SessionRun;

  it("sums each tool and each skill over the runs, the most used first", () => {
    const runs = [
      run([{ name: "Read", count: 2 }, { name: "Edit", count: 1 }], [{ name: "selo:build", count: 1, how: "command" }]),
      run([{ name: "Edit", count: 4 }], [{ name: "selo:build", count: 2, how: "command" }, { name: "selo:build", count: 1, how: "tool" }]),
    ];

    expect(sessionActivity(runs)).toEqual({
      tools: [{ name: "Edit", count: 5 }, { name: "Read", count: 2 }],
      skills: [{ name: "selo:build", count: 3, how: "command" }, { name: "selo:build", count: 1, how: "tool" }],
    });
  });

  it("skips the runs with no usage", () => {
    const empty = { since: "2026-10-23T01:10:00Z", request: "", isRequestCut: false, isRequestImage: false, usage: null } as SessionRun;

    expect(sessionActivity([empty, run([{ name: "Bash", count: 1 }], [])])).toEqual({ tools: [{ name: "Bash", count: 1 }], skills: [] });
  });
});

describe("usageSummary", () => {
  it("sums up the total, the sole model, the calls, the cache reuse and the output", () => {
    const usage = { tokens: { input: 20, cacheRead: 785_000, cacheWrite: 32_000, output: 4000 }, calls: 10, byModel: [{ model: "claude-sonnet-5-5" }] } as Parameters<typeof usageSummary>[0];
    expect(usageSummary(usage)).toBe(`821${NARROW}k tokens consommés · claude-sonnet-5-5 · 10 appels · 96${NARROW}% de cache réutilisé · 4,0${NARROW}k en sortie`);
  });

  it("leaves out the model when several share the session and the cache when nothing was read", () => {
    const usage = { tokens: { input: 0, cacheRead: 0, cacheWrite: 0, output: 5 }, calls: 1, byModel: [] } as Parameters<typeof usageSummary>[0];
    expect(usageSummary(usage)).toBe("5 tokens consommés · 1 appels · 5 en sortie");
  });
});
