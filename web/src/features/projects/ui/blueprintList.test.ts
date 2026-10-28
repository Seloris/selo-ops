import { describe, expect, it } from "vitest";
import type { Blueprint, SpecSheet } from "../data/projectView.ts";
import { filterBlueprints, hasFilter, monthLabel, parseFilter, periodGroups, sheetChips, writeFilter } from "./blueprintList.ts";

const blueprint = (name: string, overrides: Partial<Blueprint> = {}): Blueprint => ({
  name,
  file: `.planning/blueprints/${name}.md`,
  title: name,
  sheets: [],
  components: ["web"],
  state: "building",
  delta: [],
  decisions: [],
  stages: [],
  isReviewDone: false,
  isSpecMerged: false,
  nextPrompt: null,
  sessionIds: [],
  worktreeBranch: null,
  modifiedAt: null,
  ...overrides,
});

const sheet = (slug: string, overrides: Partial<SpecSheet> = {}): SpecSheet => ({
  kind: "page",
  slug,
  component: null,
  file: `.planning/pages/${slug}.md`,
  title: slug,
  route: "/",
  isStub: false,
  frCount: 0,
  brCount: 0,
  questionCount: 0,
  nextFr: "FR-01",
  nextBr: "BR-01",
  lastCommit: null,
  openBlueprints: [],
  ...overrides,
});

// 2026-10-28 is a Wednesday: this week starts on Monday 26, the last one on Monday 19.
const TODAY = "2026-10-28";
const names = (list: Blueprint[]) => list.map((b) => b.name);

describe("periodGroups", () => {
  it("splits by this week, last week, the rest of the month, then each earlier month, newest first", () => {
    const list = ["2026-10-28-a", "2026-10-26-b", "2026-10-25-c", "2026-10-19-d", "2026-10-18-e", "2026-10-01-f", "2026-09-30-g", "2025-12-02-h"].map((n) => blueprint(n));
    const groups = periodGroups(list, TODAY);
    expect(groups.map((g) => g.period)).toEqual([
      { kind: "thisWeek" },
      { kind: "lastWeek" },
      { kind: "earlierThisMonth", month: "2026-10" },
      { kind: "month", month: "2026-09" },
      { kind: "month", month: "2025-12" },
    ]);
    expect(groups.map((g) => names(g.blueprints))).toEqual([["2026-10-28-a", "2026-10-26-b"], ["2026-10-25-c", "2026-10-19-d"], ["2026-10-18-e", "2026-10-01-f"], ["2026-09-30-g"], ["2025-12-02-h"]]);
  });

  it("opens the weeks and the rest of the month, folds the earlier months", () => {
    const list = ["2026-10-27-a", "2026-10-02-b", "2026-09-10-c"].map((n) => blueprint(n));
    expect(periodGroups(list, TODAY).map((g) => g.isOpen)).toEqual([true, true, false]);
  });

  it("always opens the newest group", () => {
    const list = ["2026-08-10-a", "2026-07-01-b"].map((n) => blueprint(n));
    expect(periodGroups(list, TODAY).map((g) => g.isOpen)).toEqual([true, false]);
  });

  it("keeps a last week that reaches into the previous month whole", () => {
    // Monday 2 November 2026: last week runs from 26 October to 1 November.
    const groups = periodGroups([blueprint("2026-11-01-a"), blueprint("2026-10-26-b"), blueprint("2026-10-25-c")], "2026-11-02");
    expect(groups.map((g) => g.period)).toEqual([{ kind: "lastWeek" }, { kind: "month", month: "2026-10" }]);
    expect(names(groups[0]?.blueprints ?? [])).toEqual(["2026-11-01-a", "2026-10-26-b"]);
  });

  it("crosses a year, and puts a date after today in this week", () => {
    // Friday 1 January 2027: this week from Monday 28 December, last week from Monday 21 December.
    const groups = periodGroups([blueprint("2027-01-05-a"), blueprint("2026-12-28-b"), blueprint("2026-12-22-c"), blueprint("2026-12-20-d")], "2027-01-01");
    expect(groups.map((g) => g.period)).toEqual([{ kind: "thisWeek" }, { kind: "lastWeek" }, { kind: "month", month: "2026-12" }]);
    expect(groups.map((g) => names(g.blueprints))).toEqual([["2027-01-05-a", "2026-12-28-b"], ["2026-12-22-c"], ["2026-12-20-d"]]);
  });

  it("puts the blueprints with no date in their name last", () => {
    const groups = periodGroups([blueprint("misc"), blueprint("2026-10-27-a")], TODAY);
    expect(groups.map((g) => g.period.kind)).toEqual(["thisWeek", "undated"]);
  });

  it("keeps the order it is given inside a group", () => {
    const groups = periodGroups([blueprint("2026-10-26-b"), blueprint("2026-10-28-a")], TODAY);
    expect(names(groups[0]?.blueprints ?? [])).toEqual(["2026-10-26-b", "2026-10-28-a"]);
  });

  it("gives no group for no blueprint", () => {
    expect(periodGroups([], TODAY)).toEqual([]);
  });
});

describe("monthLabel", () => {
  it("names the month in French, capitalised, with its year", () => {
    expect(monthLabel("2026-09")).toBe("Septembre 2026");
  });

  it("names it in lower case alone for « Plus tôt en … »", () => {
    expect(monthLabel("2026-10", { isBare: true })).toBe("octobre");
  });
});

describe("filterBlueprints", () => {
  const list = [
    blueprint("2026-10-27-ask-claude", { title: "Ask Claude — questions on a file", sheets: ["projects", "question"] }),
    blueprint("2026-10-23-projects-page", { title: "Page Projets", sheets: ["projects"] }),
    blueprint("2026-10-22-sessions-live", { title: "Sessions live", sheets: [], delta: [{ sheet: "sessions-live", op: "+", id: "FR-01", text: "x" }] }),
    blueprint("2026-10-21-dash", { title: "Écran général", sheets: ["web/home"] }),
  ];

  it("keeps everything with no filter", () => {
    expect(filterBlueprints(list, { text: "", sheets: [] })).toEqual(list);
  });

  it("matches the text in the title or the name, case and accents aside", () => {
    expect(names(filterBlueprints(list, { text: "ecran", sheets: [] }))).toEqual(["2026-10-21-dash"]);
    expect(names(filterBlueprints(list, { text: "PROJECTS-pa", sheets: [] }))).toEqual(["2026-10-23-projects-page"]);
    expect(names(filterBlueprints(list, { text: "  claude ", sheets: [] }))).toEqual(["2026-10-27-ask-claude"]);
  });

  it("keeps a blueprint touching any chosen sheet, from its sheets or its delta", () => {
    expect(names(filterBlueprints(list, { text: "", sheets: ["question", "sessions-live"] }))).toEqual(["2026-10-27-ask-claude", "2026-10-22-sessions-live"]);
    expect(names(filterBlueprints(list, { text: "", sheets: ["web/home"] }))).toEqual(["2026-10-21-dash"]);
  });

  it("needs both the text and a sheet when both are set", () => {
    expect(names(filterBlueprints(list, { text: "page", sheets: ["projects"] }))).toEqual(["2026-10-23-projects-page"]);
  });
});

describe("sheetChips", () => {
  it("gives the touched pages, then the domain sheets with app first, each with its count; the untouched left out", () => {
    const sheets = [
      sheet("session", { kind: "domain", file: ".planning/domain/session.md" }),
      sheet("projects"),
      sheet("app", { kind: "app", file: ".planning/domain/app.md" }),
      sheet("help"),
      sheet("home", { component: "web", file: ".planning/pages/web/home.md" }),
    ];
    const list = [
      blueprint("2026-10-27-a", { sheets: ["projects", "session"] }),
      blueprint("2026-10-26-b", { sheets: ["projects", "app"] }),
      blueprint("2026-10-25-c", { sheets: ["web/home"] }),
    ];
    expect(sheetChips(sheets, list).map((c) => [c.key, c.count])).toEqual([
      ["web/home", 1],
      ["projects", 2],
      ["app", 1],
      ["session", 1],
    ]);
  });
});

describe("parseFilter and writeFilter", () => {
  it("reads the text and the chosen sheets from the address", () => {
    expect(parseFilter(new URLSearchParams("q=ask&sheets=projects,web%2Fhome"))).toEqual({ text: "ask", sheets: ["projects", "web/home"] });
    expect(parseFilter(new URLSearchParams(""))).toEqual({ text: "", sheets: [] });
  });

  it("writes them back, an empty one removed", () => {
    expect(writeFilter({ text: "ask", sheets: ["projects", "question"] })).toEqual({ q: "ask", sheets: "projects,question" });
    expect(writeFilter({ text: "", sheets: [] })).toEqual({ q: null, sheets: null });
  });

  it("tells when a filter holds", () => {
    expect(hasFilter({ text: " ", sheets: [] })).toBe(false);
    expect(hasFilter({ text: "", sheets: ["projects"] })).toBe(true);
  });
});
