import { describe, expect, it } from "vitest";
import {
  archivedSessions,
  closedSessions,
  countsOf,
  groupSessions,
  isFinished,
  matches,
  openCountByProject,
  sortSessions,
  type Project,
  type Session,
} from "./sessionView.ts";

const NOW = Date.parse("2026-10-22T12:00:00.000Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

let counter = 0;
function buildSession(overrides: Partial<Session> = {}): Session {
  counter += 1;
  return {
    id: `s${counter}`,
    projectId: "p-ledger",
    branch: "main",
    folder: "~/code/ledger-api",
    lane: "free",
    request: "Fix the build",
    isRequestCut: false,
    isRequestImage: false,
    blueprint: null,
    step: null,
    substep: null,
    state: "working",
    isClosed: false,
    isArchived: false,
    archivedAt: null,
    canArchive: false,
    note: null,
    question: null,
    permissionTool: null,
    pendingCommit: null,
    error: null,
    recap: null,
    commits: [],
    nextAction: null,
    model: null,
    effort: null,
    permissionMode: null,
    blockers: [],
    subagents: [],
    usage: null,
    runUsage: null,
    runs: [],
    isRunListCut: false,
    touchedFiles: [],
    desktopLink: null,
    isOutsideSelo: false,
    writtenBy: null,
    createdAt: ago(60),
    updatedAt: ago(1),
    ...overrides,
  };
}

const projects: Project[] = [
  { id: "p-ledger", name: "ledger-api", branch: "main", changedCount: 2 },
  { id: "p-harbor", name: "harbor-mobile", branch: "develop", changedCount: 0 },
];
const byId = new Map(projects.map((p) => [p.id, p]));
const ids = (list: Session[]) => list.map((s) => s.id);

describe("sortSessions", () => {
  it("puts the most urgent state first, then the most recently updated", () => {
    // Arrange
    const done = buildSession({ id: "done", state: "job-done", updatedAt: ago(1) });
    const askOld = buildSession({ id: "ask-old", state: "awaiting-answer", updatedAt: ago(50) });
    const askNew = buildSession({ id: "ask-new", state: "awaiting-answer", updatedAt: ago(2) });
    const permission = buildSession({ id: "permission", state: "awaiting-permission", updatedAt: ago(1) });
    const commit = buildSession({ id: "commit", state: "awaiting-commit" });
    const stopped = buildSession({ id: "stopped", state: "stopped" });
    const working = buildSession({ id: "working", state: "working" });
    const turn = buildSession({ id: "turn", state: "turn-ended" });

    // Act
    const sorted = sortSessions([done, turn, working, stopped, commit, permission, askOld, askNew]);

    // Assert
    expect(ids(sorted)).toEqual(["ask-new", "ask-old", "permission", "commit", "stopped", "working", "turn", "done"]);
  });
});

describe("countsOf", () => {
  it("counts the open sessions, their projects and those to handle, closed and archived ones aside", () => {
    // Arrange
    const sessions = [
      buildSession({ state: "awaiting-answer" }),
      buildSession({ state: "stopped", projectId: "p-harbor" }),
      buildSession({ state: "awaiting-permission" }),
      buildSession({ state: "working" }),
      buildSession({ state: "stopped", isClosed: true, projectId: "p-other" }),
      buildSession({ state: "job-done", isArchived: true, projectId: "p-third" }),
    ];

    // Act
    const counts = countsOf(sessions);

    // Assert
    expect(counts).toEqual({ open: 4, projects: 2, todo: 3 });
  });
});

describe("openCountByProject", () => {
  it("counts each project's open sessions", () => {
    // Arrange
    const sessions = [buildSession(), buildSession(), buildSession({ projectId: "p-harbor", isClosed: true })];

    // Act
    const counts = openCountByProject(sessions);

    // Assert
    expect(Object.fromEntries(counts)).toEqual({ "p-ledger": 2 });
  });
});

describe("matches", () => {
  it.each([
    ["the request", "promo"],
    ["the blueprint", "monthly-balance"],
    ["the branch", "claude/live"],
    ["the project's name", "LEDGER"],
  ])("finds a session by %s, ignoring case", (_what, search) => {
    // Arrange
    const session = buildSession({ request: "Keep the promo code", blueprint: ".planning/blueprints/2026-10-20-monthly-balance.md", branch: "claude/live" });

    // Act
    const found = matches(session, { projectIds: null, search }, byId);

    // Assert
    expect(found).toBe(true);
  });

  it("leaves out a session whose project is not checked", () => {
    // Arrange
    const session = buildSession({ projectId: "p-harbor" });

    // Act
    const found = matches(session, { projectIds: new Set(["p-ledger"]), search: "" }, byId);

    // Assert
    expect(found).toBe(false);
  });

  it("leaves out a session the search does not match", () => {
    // Act
    const found = matches(buildSession(), { projectIds: null, search: "nothing like it" }, byId);

    // Assert
    expect(found).toBe(false);
  });
});

describe("groupSessions", () => {
  it("by project, puts first the project holding the most urgent session", () => {
    // Arrange
    const sessions = [
      buildSession({ id: "l1", projectId: "p-ledger", state: "working" }),
      buildSession({ id: "h1", projectId: "p-harbor", state: "awaiting-commit" }),
      buildSession({ id: "l2", projectId: "p-ledger", state: "awaiting-answer" }),
      buildSession({ id: "closed", projectId: "p-harbor", isClosed: true }),
    ];

    // Act
    const blocks = groupSessions(sessions, "project", { projectIds: null, search: "" }, byId);

    // Assert
    expect(blocks.map((b) => [b.key, ids(b.sessions), b.todoCount])).toEqual([
      ["p-ledger", ["l2", "l1"], 1],
      ["p-harbor", ["h1"], 1],
    ]);
  });

  it("by status, gives the non-empty blocks À traiter, En cours, Au repos and Job done in that order", () => {
    // Arrange
    const sessions = [
      buildSession({ id: "done", state: "job-done" }),
      buildSession({ id: "turn", state: "turn-ended" }),
      buildSession({ id: "stopped", state: "stopped" }),
      buildSession({ id: "permission", state: "awaiting-permission" }),
    ];

    // Act
    const blocks = groupSessions(sessions, "status", { projectIds: null, search: "" }, byId);

    // Assert
    expect(blocks.map((b) => [b.key, ids(b.sessions)])).toEqual([
      ["todo", ["permission", "stopped"]],
      ["rest", ["turn"]],
      ["done", ["done"]],
    ]);
  });

  it("with no grouping, gives one sorted block, or none when nothing matches", () => {
    // Arrange
    const sessions = [buildSession({ id: "w", state: "working" }), buildSession({ id: "a", state: "awaiting-answer" })];

    // Act
    const all = groupSessions(sessions, "none", { projectIds: null, search: "" }, byId);
    const none = groupSessions(sessions, "none", { projectIds: null, search: "zzz" }, byId);

    // Assert
    expect(all.map((b) => ids(b.sessions))).toEqual([["a", "w"]]);
    expect(none).toEqual([]);
  });
});

describe("closedSessions and archivedSessions", () => {
  it("lists the closed sessions not archived, and the archived ones newest archive first", () => {
    // Arrange
    const sessions = [
      buildSession({ id: "closed", isClosed: true, state: "stopped" }),
      buildSession({ id: "closed-archived", isClosed: true, isArchived: true, archivedAt: ago(30), state: "job-done" }),
      buildSession({ id: "archived", isArchived: true, archivedAt: ago(5), state: "job-done" }),
      buildSession({ id: "open" }),
    ];
    const filters = { projectIds: null, search: "" };

    // Act
    const closed = closedSessions(sessions, filters, byId);
    const archived = archivedSessions(sessions, filters, byId);

    // Assert
    expect(ids(closed)).toEqual(["closed"]);
    expect(ids(archived)).toEqual(["archived", "closed-archived"]);
  });
});

describe("sessions outside selo", () => {
  // `session` BR-12: a session outside selo is a session like any other in the counts, the groups and the filters.
  const outside = (overrides: Partial<Session> = {}) =>
    buildSession({ lane: "outside", isOutsideSelo: true, blockers: [], effort: null, permissionMode: null, ...overrides });

  it("counts open sessions outside selo, and those waiting for an answer as to handle", () => {
    // Arrange
    const sessions = [buildSession(), outside({ state: "awaiting-answer", projectId: "p-notes" }), outside({ state: "turn-ended" })];

    // Act
    const counts = countsOf(sessions);

    // Assert
    expect(counts).toEqual({ open: 3, projects: 2, todo: 1 });
    expect(openCountByProject(sessions).get("p-notes")).toBe(1);
  });

  it("groups them with the selo sessions of their project, and in their state's block", () => {
    // Arrange
    const selo = buildSession({ state: "working" });
    const asking = outside({ state: "awaiting-answer" });
    const own = outside({ state: "turn-ended", projectId: "p-notes" });

    // Act
    const byProject = groupSessions([selo, asking, own], "project", { projectIds: null, search: "" }, byId);
    const byStatus = groupSessions([selo, asking, own], "status", { projectIds: null, search: "" }, byId);

    // Assert
    expect(byProject.map((b) => [b.key, ids(b.sessions)])).toEqual([
      ["p-ledger", [asking.id, selo.id]],
      ["p-notes", [own.id]],
    ]);
    expect(byStatus.map((b) => [b.key, ids(b.sessions)])).toEqual([
      ["todo", [asking.id]],
      ["run", [selo.id]],
      ["rest", [own.id]],
    ]);
  });

  it("filters them by project and search like any session", () => {
    // Arrange
    const session = outside({ request: "Ajouter une option --json", projectId: "p-notes" });

    // Act / Assert
    expect(matches(session, { projectIds: new Set(["p-notes"]), search: "json" }, byId)).toBe(true);
    expect(matches(session, { projectIds: new Set(["p-ledger"]), search: "" }, byId)).toBe(false);
    expect(matches(session, { projectIds: null, search: "promo" }, byId)).toBe(false);
  });
});

describe("isFinished", () => {
  it("holds for a done session or a turn end, not for one that waits or works", () => {
    // Arrange
    const states = ["job-done", "turn-ended", "working", "awaiting-answer", "awaiting-commit", "stopped"] as const;

    // Act
    const finished = states.map((state) => isFinished(buildSession({ state })));

    // Assert
    expect(finished).toEqual([true, true, false, false, false, false]);
  });
});
