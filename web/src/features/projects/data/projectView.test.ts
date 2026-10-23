import { describe, expect, it } from "vitest";
import {
  blueprintLists,
  blueprintsTouching,
  dateOf,
  deltaBySheet,
  deltaSplit,
  pageCounts,
  progressSteps,
  sheetLists,
  sortProjects,
  stateCounts,
  type Blueprint,
  type ProjectOverview,
  type SpecSheet,
} from "./projectView.ts";

const blueprint = (overrides: Partial<Blueprint> = {}): Blueprint => ({
  name: "2026-01-01-due-date",
  file: ".planning/blueprints/2026-01-01-due-date.md",
  title: "Due date",
  sheets: ["home"],
  components: ["api", "web"],
  state: "building",
  delta: [],
  decisions: [],
  stages: [
    { number: 1, component: "api", commit: "feat(due-date): api — x", sha: "1111111", isDone: true },
    { number: 2, component: "web", commit: "feat(due-date): web — x", sha: null, isDone: false },
  ],
  isReviewDone: false,
  isSpecMerged: false,
  nextPrompt: null,
  sessionIds: [],
  worktreeBranch: null,
  modifiedAt: null,
  ...overrides,
});

const project = (name: string, blueprints: Blueprint[] = []): ProjectOverview => ({
  id: name,
  name,
  root: `C:/code/${name}`,
  branch: "main",
  baseBranch: "main",
  seloVersion: "2.4.0",
  changedCount: 0,
  unpushedCount: 0,
  hasPlanning: true,
  error: null,
  worktrees: [],
  sheets: [],
  blueprints,
  ideaCount: 0,
  debtCount: 0,
  sessionIds: [],
  slots: [],
});

const sheet = (overrides: Partial<SpecSheet> = {}): SpecSheet => ({
  kind: "page",
  slug: "home",
  component: null,
  file: ".planning/pages/home.md",
  title: "Home",
  route: "/",
  isStub: false,
  frCount: 3,
  brCount: 0,
  questionCount: 0,
  nextFr: "FR-04",
  nextBr: "BR-01",
  lastCommit: null,
  openBlueprints: [],
  ...overrides,
});

describe("stateCounts", () => {
  it("counts each state present, in the states' order", () => {
    const list = [blueprint({ state: "legacy" }), blueprint({ state: "building" }), blueprint({ state: "draft" }), blueprint({ state: "building" })];
    expect(stateCounts(list)).toEqual([
      { state: "draft", count: 1 },
      { state: "building", count: 2 },
      { state: "legacy", count: 1 },
    ]);
  });
});

describe("pageCounts", () => {
  it("counts projects, open blueprints and those being built", () => {
    const projects = [project("a", [blueprint(), blueprint({ state: "done" })]), project("b", [blueprint({ state: "ready" }), blueprint({ state: "legacy" })])];
    expect(pageCounts(projects)).toEqual({ projects: 2, open: 2, building: 1 });
  });
});

describe("sortProjects", () => {
  it("puts the projects with an open blueprint first, then sorts by name", () => {
    const projects = [project("zeta", [blueprint()]), project("alpha", [blueprint({ state: "done" })]), project("beta"), project("Gamma", [blueprint({ state: "draft" })])];
    expect(sortProjects(projects).map((p) => p.name)).toEqual(["Gamma", "zeta", "alpha", "beta"]);
  });
});

describe("deltaSplit and deltaBySheet", () => {
  const delta = [
    { sheet: "home", op: "+", id: "FR-01", text: "a" },
    { sheet: "todo", op: "~", id: "BR-01", text: "b" },
    { sheet: "home", op: "-", id: "FR-02", text: "c" },
    { sheet: "home", op: "+", id: "Non-goal", text: "d" },
  ];

  it("counts the lines added, changed and removed", () => {
    expect(deltaSplit(delta)).toEqual({ added: 2, changed: 1, removed: 1 });
  });

  it("groups the lines by sheet, in their first order", () => {
    expect(deltaBySheet(delta).map((g) => [g.sheet, g.lines.map((l) => l.id)])).toEqual([
      ["home", ["FR-01", "FR-02", "Non-goal"]],
      ["todo", ["BR-01"]],
    ]);
  });
});

describe("progressSteps", () => {
  it("gives the stages, then the review, then the merge", () => {
    expect(progressSteps(blueprint({ isReviewDone: true })).map((s) => [s.kind, s.isDone])).toEqual([
      ["stage", true],
      ["stage", false],
      ["review", true],
      ["merge", false],
    ]);
  });

  it("gives a legacy blueprint no step", () => {
    expect(progressSteps(blueprint({ state: "legacy" }))).toEqual([]);
  });
});

describe("blueprintLists", () => {
  it("lists the blueprints newest first and puts the legacy ones apart", () => {
    const list = [blueprint({ name: "2026-01-01-a" }), blueprint({ name: "2025-01-01-old", state: "legacy" }), blueprint({ name: "2026-02-01-b", state: "done" })];
    const { listed, legacy } = blueprintLists(list);
    expect([listed.map((b) => b.name), legacy.map((b) => b.name)]).toEqual([["2026-02-01-b", "2026-01-01-a"], ["2025-01-01-old"]]);
  });
});

describe("sheetLists", () => {
  it("lists the pages, then the domain sheets with app first", () => {
    const sheets = [sheet({ kind: "domain", slug: "todo" }), sheet({ slug: "zz" }), sheet({ kind: "app", slug: "app" }), sheet({ slug: "aa" })];
    const { pages, domains } = sheetLists(sheets);
    expect([pages.map((s) => s.slug), domains.map((s) => s.slug)]).toEqual([["aa", "zz"], ["app", "todo"]]);
  });
});

describe("blueprintsTouching", () => {
  it("gives the open blueprints touching a sheet with their lines for it", () => {
    const touching = blueprint({ name: "x", delta: [{ sheet: "home", op: "+", id: "FR-04", text: "a" }, { sheet: "todo", op: "~", id: "BR-01", text: "b" }] });
    const done = blueprint({ name: "y", state: "done" });
    const result = blueprintsTouching([touching, done], sheet({ openBlueprints: ["x", "y"] }));
    expect(result.map((r) => [r.blueprint.name, r.lines.map((l) => l.id)])).toEqual([["x", ["FR-04"]]]);
  });
});

describe("dateOf", () => {
  it("reads the date from the blueprint's name", () => {
    expect([dateOf(blueprint()), dateOf(blueprint({ name: "no-date" }))]).toEqual(["2026-01-01", null]);
  });
});
