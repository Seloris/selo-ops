import { describe, expect, it } from "vitest";
import {
  EMPTY_FORM,
  buildableBlueprints,
  canOpen,
  commandOf,
  folderOf,
  launchTitleOf,
  parsePrefs,
  projectOfFolder,
  type Blueprint,
  type Mockup,
  type NewSessionForm,
  type ProjectOverview,
} from "./newSession.ts";

const simple = (overrides: Partial<NewSessionForm> = {}): NewSessionForm => ({ ...EMPTY_FORM, ...overrides });
const form = (overrides: Partial<NewSessionForm> = {}): NewSessionForm => simple({ mode: "advanced", ...overrides });

const blueprint = (file: string, state: Blueprint["state"]): Blueprint => ({
  name: file,
  file: `.planning/blueprints/${file}.md`,
  title: file,
  sheets: [],
  components: [],
  state,
  delta: [],
  decisions: [],
  stages: [],
  isReviewDone: false,
  isSpecMerged: false,
  nextPrompt: null,
  sessionIds: [],
  worktreeBranch: null,
  modifiedAt: null,
});

const mockup = (name: string, worktreeBranch: string | null = null): Mockup => ({ file: `.planning/mockups/${name}.html`, title: name, worktreeBranch });

const project = (id: string, root: string, worktrees: string[] = [], blueprints: Blueprint[] = [], mockups: Mockup[] = []): ProjectOverview => ({
  id,
  name: id,
  root,
  branch: "main",
  baseBranch: "main",
  seloVersion: "2.4.0",
  changedCount: 0,
  unpushedCount: 0,
  hasPlanning: true,
  error: null,
  worktrees: worktrees.map((w) => ({ root: w, branch: "wt", aheadCount: 0, changedCount: 0 })),
  sheets: [],
  blueprints,
  mockups,
  ideaCount: 0,
  debtCount: 0,
  sessionIds: [],
  slots: [],
});

describe("commandOf in « Simple » (sessions-live FR-45, FR-47)", () => {
  it("opens on « Je reste là »: the pilot on the request", () => {
    expect(commandOf(simple({ request: "  Archiver en lot  " }))).toBe("/selo-flow:pilot Archiver en lot");
  });

  it("ends with `— autonomous` on « Je m'absente »", () => {
    expect(commandOf(simple({ request: "x", presence: "leave" }))).toBe("/selo-flow:pilot x — autonomous");
  });

  it("builds a chosen blueprint, or hands it to the autonomous pilot", () => {
    const resume = { kind: "blueprint", file: ".planning/blueprints/b.md" } as const;
    expect(commandOf(simple({ resume, request: "ignored" }))).toBe("/selo-flow:build .planning/blueprints/b.md");
    expect(commandOf(simple({ resume, presence: "leave" }))).toBe("/selo-flow:pilot .planning/blueprints/b.md — autonomous");
  });

  it("gives the pilot a chosen mockup after the request, before `— autonomous`", () => {
    const resume = { kind: "mockup", file: ".planning/mockups/m.html" } as const;
    expect(commandOf(simple({ resume, request: "x" }))).toBe("/selo-flow:pilot x — mockup .planning/mockups/m.html");
    expect(commandOf(simple({ resume, request: "x", presence: "leave" }))).toBe("/selo-flow:pilot x — mockup .planning/mockups/m.html — autonomous");
  });

  it("ignores what only « Avancé » sets", () => {
    expect(commandOf(simple({ skill: "fastlane", request: "x", iterate: true, noBrowser: true, touches: ["a.md"], mockupFile: "m.html" }))).toBe("/selo-flow:pilot x");
  });
});

describe("commandOf in « Avancé » (sessions-live FR-46, FR-47)", () => {
  it("opens on the autonomous pilot, the request after the skill and `— autonomous` last", () => {
    expect(commandOf(form({ request: "  Archiver en lot  " }))).toBe("/selo-flow:pilot Archiver en lot — autonomous");
  });

  it("adds the autonomous pilot's forced lane, its stop at the blueprint and no browser, then `— autonomous`", () => {
    expect(commandOf(form({ request: "x", lane: "blueprint", untilBlueprint: true, noBrowser: true }))).toBe(
      "/selo-flow:pilot x — blueprint — until blueprint — no browser — autonomous",
    );
  });

  it("drops the stop at the blueprint when the lane is fastlane", () => {
    expect(commandOf(form({ request: "x", lane: "fastlane", untilBlueprint: true }))).toBe("/selo-flow:pilot x — fastlane — autonomous");
  });

  it("starts the autonomous pilot from a blueprint's file, without lane options", () => {
    expect(commandOf(form({ fromBlueprint: true, blueprintFile: ".planning/blueprints/b.md", lane: "fastlane", noBrowser: true }))).toBe(
      "/selo-flow:pilot .planning/blueprints/b.md — no browser — autonomous",
    );
  });

  it("lets selo pick the lane from a request, with no browser only", () => {
    expect(commandOf(form({ skill: "pilot", request: "x", lane: "blueprint", untilBlueprint: true, noBrowser: true }))).toBe("/selo-flow:pilot x — no browser");
    expect(commandOf(form({ skill: "pilot", request: "x", fromBlueprint: true, blueprintFile: "b.md" }))).toBe("/selo-flow:pilot x");
  });

  it("gives fastlane its iterate mode", () => {
    expect(commandOf(form({ skill: "fastlane", request: "x", iterate: true, noBrowser: true }))).toBe("/selo-flow:fastlane x — iterate — no browser");
  });

  it("builds a blueprint, one stage when asked", () => {
    expect(commandOf(form({ skill: "build", blueprintFile: ".planning/blueprints/b.md", stage: 2 }))).toBe("/selo-flow:build .planning/blueprints/b.md — stage 2");
  });

  it("ignores options a skill does not take", () => {
    expect(commandOf(form({ skill: "grill", request: "x", iterate: true, noBrowser: true, lane: "blueprint" }))).toBe("/selo-flow:grill x");
  });

  it("leaves review alone when no scope is given", () => {
    expect(commandOf(form({ skill: "review" }))).toBe("/selo-flow:review");
  });

  it("gives a free session the request alone", () => {
    expect(commandOf(form({ skill: "free", request: "Pourquoi le hook échoue ?" }))).toBe("Pourquoi le hook échoue ?");
  });

  it("mentions each file the request touches after it, before the flags", () => {
    const touches = [".planning/pages/projects.md", ".planning/domain/project.md"];
    expect(commandOf(form({ skill: "fastlane", request: "x", touches, iterate: true }))).toBe("/selo-flow:fastlane x @.planning/pages/projects.md @.planning/domain/project.md — iterate");
    expect(commandOf(form({ skill: "free", request: "x", touches }))).toBe("x @.planning/pages/projects.md @.planning/domain/project.md");
    expect(commandOf(form({ skill: "review", touches }))).toBe("/selo-flow:review @.planning/pages/projects.md @.planning/domain/project.md");
  });

  it("mentions no file for a blueprint's file", () => {
    expect(commandOf(form({ skill: "build", blueprintFile: "b.md", touches: ["a.md"] }))).toBe("/selo-flow:build b.md");
  });

  it("gives fastlane and blueprint the chosen mockup as their first flag", () => {
    expect(commandOf(form({ skill: "fastlane", request: "x", mockupFile: "m.html", iterate: true }))).toBe("/selo-flow:fastlane x — mockup m.html — iterate");
    expect(commandOf(form({ skill: "blueprint", request: "x", mockupFile: "m.html" }))).toBe("/selo-flow:blueprint x — mockup m.html");
    expect(commandOf(form({ skill: "pilot", request: "x", mockupFile: "m.html" }))).toBe("/selo-flow:pilot x");
  });
});

describe("canOpen (sessions-live FR-47)", () => {
  it("waits in « Simple » for the request, a chosen blueprint going without one", () => {
    expect(canOpen(simple({ request: " " }))).toBe(false);
    expect(canOpen(simple({ request: "x" }))).toBe(true);
    expect(canOpen(simple({ resume: { kind: "blueprint", file: "b.md" } }))).toBe(true);
    expect(canOpen(simple({ resume: { kind: "mockup", file: "m.html" } }))).toBe(false);
  });

  it("waits for the request", () => {
    expect(canOpen(form({ request: "  " }))).toBe(false);
    expect(canOpen(form({ request: "x" }))).toBe(true);
  });

  it("lets review and try go without a request", () => {
    expect(canOpen(form({ skill: "review" }))).toBe(true);
    expect(canOpen(form({ skill: "try" }))).toBe(true);
  });

  it("waits for the blueprint for build and an autonomous pilot started from one", () => {
    expect(canOpen(form({ skill: "build", request: "x" }))).toBe(false);
    expect(canOpen(form({ skill: "build", blueprintFile: "b.md" }))).toBe(true);
    expect(canOpen(form({ fromBlueprint: true, request: "x" }))).toBe(false);
  });
});

describe("launchTitleOf (sessions-live FR-61, `session` BR-24)", () => {
  const inWorktree = { ...blueprint("2026-01-02-tags", "ready"), title: "Tags", worktreeBranch: "wt" };
  const p = project("p", "C:/p", ["C:/p/.claude/worktrees/x"], [inWorktree]);

  it("names the session after the request", () => {
    expect(launchTitleOf(p, simple({ request: "  Ajoute un tag " }))).toBe("Ajoute un tag");
  });

  it("names it after the chosen blueprint's title", () => {
    expect(launchTitleOf(p, simple({ resume: { kind: "blueprint", file: inWorktree.file } }))).toBe("Tags");
    expect(launchTitleOf(p, form({ skill: "build", blueprintFile: inWorktree.file }))).toBe("Tags");
  });

  it("names a review with no request after its command", () => {
    expect(launchTitleOf(p, form({ skill: "review" }))).toBe("/selo-flow:review");
  });
});

describe("projectOfFolder (sessions-live FR-43)", () => {
  const factory = project("factory", "C:/WS/webapp-factory");
  const sample = project("todo", "C:/WS/webapp-factory/samples/todo-app");
  const ops = project("ops", "C:/WS/ops", ["C:/WS/ops/.claude/worktrees/x"]);

  it("finds the project holding the folder, the deepest root winning", () => {
    expect(projectOfFolder("C:/WS/webapp-factory/samples/todo-app/web", [factory, sample])?.id).toBe("todo");
    expect(projectOfFolder("C:/WS/webapp-factory", [factory, sample])?.id).toBe("factory");
  });

  it("finds a project by one of its worktrees, whatever the slashes and the case", () => {
    expect(projectOfFolder("c:\\WS\\ops\\.claude\\worktrees\\x", [ops])?.id).toBe("ops");
  });

  it("does not take a sibling folder sharing the root's start", () => {
    expect(projectOfFolder("C:/WS/ops-old", [ops])).toBeNull();
  });
});

describe("folderOf (sessions-live FR-47)", () => {
  const inWorktree = { ...blueprint("w", "ready"), worktreeBranch: "wt" };
  const p = project("p", "C:/p", ["C:/p/.claude/worktrees/x"], [blueprint("b", "ready"), inWorktree]);

  it("opens in the project's folder", () => {
    expect(folderOf(p, form({ request: "x" }))).toBe("C:/p");
    expect(folderOf(p, form({ skill: "build", blueprintFile: blueprint("b", "ready").file }))).toBe("C:/p");
  });

  it("opens in the worktree holding a blueprint only it holds", () => {
    expect(folderOf(p, form({ skill: "build", blueprintFile: inWorktree.file }))).toBe("C:/p/.claude/worktrees/x");
    expect(folderOf(p, form({ fromBlueprint: true, blueprintFile: inWorktree.file }))).toBe("C:/p/.claude/worktrees/x");
  });

  it("opens in the worktree holding a mockup only it holds", () => {
    const q = project("q", "C:/q", ["C:/q/.claude/worktrees/x"], [], [mockup("m"), mockup("w", "wt")]);
    expect(folderOf(q, simple({ resume: { kind: "mockup", file: mockup("w").file }, request: "x" }))).toBe("C:/q/.claude/worktrees/x");
    expect(folderOf(q, form({ skill: "fastlane", request: "x", mockupFile: mockup("w").file }))).toBe("C:/q/.claude/worktrees/x");
    expect(folderOf(q, form({ skill: "fastlane", request: "x", mockupFile: mockup("m").file }))).toBe("C:/q");
  });

  it("starts the recap's session in the worktree that alone holds the chosen blueprint (sessions-live FR-61)", () => {
    expect(folderOf(p, simple({ presence: "leave", resume: { kind: "blueprint", file: inWorktree.file } }))).toBe("C:/p/.claude/worktrees/x");
  });

  it("opens « Simple » on a chosen blueprint in the worktree that alone holds it", () => {
    expect(folderOf(p, simple({ resume: { kind: "blueprint", file: inWorktree.file } }))).toBe("C:/p/.claude/worktrees/x");
  });

  it("ignores the blueprint once the form takes a request", () => {
    expect(folderOf(p, form({ skill: "fastlane", blueprintFile: inWorktree.file, request: "x" }))).toBe("C:/p");
  });
});

describe("buildableBlueprints (sessions-live FR-45, FR-46)", () => {
  it("keeps the blueprints « Prêt » and « En construction », in the export's order", () => {
    const p = project("p", "C:/p", [], [blueprint("a", "draft"), blueprint("b", "building"), blueprint("c", "done"), blueprint("d", "ready")]);
    expect(buildableBlueprints(p).map((b) => b.name)).toEqual(["b", "d"]);
  });
});

describe("parsePrefs (sessions-live FR-49)", () => {
  it("opens « Simple » and « Je reste là » the first time", () => {
    expect(parsePrefs(null)).toEqual({ mode: "simple", presence: "stay", isAutoMode: false });
  });

  it("keeps the mode and the choice made last", () => {
    expect(parsePrefs({ mode: "advanced", presence: "leave" })).toEqual({ mode: "advanced", presence: "leave", isAutoMode: false });
  });

  it("keeps « Mode auto » on once chosen (sessions-live FR-61)", () => {
    expect(parsePrefs({ mode: "simple", presence: "stay", isAutoMode: true })).toEqual({ mode: "simple", presence: "stay", isAutoMode: true });
  });

  it("falls back on each value it does not know", () => {
    expect(parsePrefs({ mode: "expert", presence: 3, isAutoMode: "yes" })).toEqual({ mode: "simple", presence: "stay", isAutoMode: false });
    expect(parsePrefs("advanced")).toEqual({ mode: "simple", presence: "stay", isAutoMode: false });
  });
});
