import { describe, expect, it } from "vitest";
import {
  EMPTY_FORM,
  buildableBlueprints,
  canOpen,
  commandOf,
  folderOf,
  newSessionLink,
  projectOfFolder,
  type Blueprint,
  type NewSessionForm,
  type ProjectOverview,
} from "./newSession.ts";

const form = (overrides: Partial<NewSessionForm> = {}): NewSessionForm => ({ ...EMPTY_FORM, ...overrides });

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

const project = (id: string, root: string, worktrees: string[] = [], blueprints: Blueprint[] = []): ProjectOverview => ({
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
  ideaCount: 0,
  debtCount: 0,
  sessionIds: [],
  slots: [],
});

describe("commandOf (sessions-live FR-45, FR-46)", () => {
  it("opens on autopilot with the request after the skill", () => {
    expect(commandOf(form({ request: "  Archiver en lot  " }))).toBe("/selo:autopilot Archiver en lot");
  });

  it("adds autopilot's forced lane, its stop at the blueprint and no browser, in that order", () => {
    expect(commandOf(form({ request: "x", lane: "blueprint", untilBlueprint: true, noBrowser: true }))).toBe(
      "/selo:autopilot x — blueprint — until blueprint — no browser",
    );
  });

  it("drops the stop at the blueprint when the lane is fastlane", () => {
    expect(commandOf(form({ request: "x", lane: "fastlane", untilBlueprint: true }))).toBe("/selo:autopilot x — fastlane");
  });

  it("starts autopilot from a blueprint's file, without lane options", () => {
    expect(commandOf(form({ fromBlueprint: true, blueprintFile: ".planning/blueprints/b.md", lane: "fastlane", noBrowser: true }))).toBe(
      "/selo:autopilot .planning/blueprints/b.md — no browser",
    );
  });

  it("gives fastlane its iterate mode", () => {
    expect(commandOf(form({ skill: "fastlane", request: "x", iterate: true, noBrowser: true }))).toBe("/selo:fastlane x — iterate — no browser");
  });

  it("builds a blueprint, one stage when asked", () => {
    expect(commandOf(form({ skill: "build", blueprintFile: ".planning/blueprints/b.md", stage: 2 }))).toBe("/selo:build .planning/blueprints/b.md — stage 2");
  });

  it("ignores options a skill does not take", () => {
    expect(commandOf(form({ skill: "grill", request: "x", iterate: true, noBrowser: true, lane: "blueprint" }))).toBe("/selo:grill x");
  });

  it("leaves review alone when no scope is given", () => {
    expect(commandOf(form({ skill: "review" }))).toBe("/selo:review");
  });

  it("gives a free session the request alone", () => {
    expect(commandOf(form({ skill: "free", request: "Pourquoi le hook échoue ?" }))).toBe("Pourquoi le hook échoue ?");
  });
});

describe("canOpen (sessions-live FR-46)", () => {
  it("waits for the request", () => {
    expect(canOpen(form({ request: "  " }))).toBe(false);
    expect(canOpen(form({ request: "x" }))).toBe(true);
  });

  it("lets review and try go without a request", () => {
    expect(canOpen(form({ skill: "review" }))).toBe(true);
    expect(canOpen(form({ skill: "try" }))).toBe(true);
  });

  it("waits for the blueprint for build and an autopilot started from one", () => {
    expect(canOpen(form({ skill: "build", request: "x" }))).toBe(false);
    expect(canOpen(form({ skill: "build", blueprintFile: "b.md" }))).toBe(true);
    expect(canOpen(form({ fromBlueprint: true, request: "x" }))).toBe(false);
  });
});

describe("newSessionLink (sessions-live FR-46)", () => {
  it("opens the desktop app's new session with the command and the folder, encoded", () => {
    expect(newSessionLink("/selo:fastlane a & b — no browser", "C:/WS/my app")).toBe(
      "claude://code/new?q=%2Fselo%3Afastlane%20a%20%26%20b%20%E2%80%94%20no%20browser&folder=C%3A%2FWS%2Fmy%20app",
    );
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

describe("folderOf (sessions-live FR-46)", () => {
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

  it("ignores the blueprint once the form takes a request", () => {
    expect(folderOf(p, form({ skill: "fastlane", blueprintFile: inWorktree.file, request: "x" }))).toBe("C:/p");
  });
});

describe("buildableBlueprints (sessions-live FR-44)", () => {
  it("keeps the blueprints « Prêt » and « En construction », in the export's order", () => {
    const p = project("p", "C:/p", [], [blueprint("a", "draft"), blueprint("b", "building"), blueprint("c", "done"), blueprint("d", "ready")]);
    expect(buildableBlueprints(p).map((b) => b.name)).toEqual(["b", "d"]);
  });
});
