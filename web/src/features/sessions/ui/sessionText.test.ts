import { describe, expect, it } from "vitest";
import type { InstalledPlugin, Session } from "../data/sessionView.ts";
import {
  ageDisplay,
  awaitedOf,
  blockerHint,
  blockerLabel,
  blockerTone,
  calmText,
  changedText,
  closeText,
  createdText,
  desktopLinkOf,
  isPluginOutdated,
  modelText,
  pluginsText,
  requestText,
  rowContext,
  sessionLaneLabel,
  shownBlockers,
  toneOf,
  writtenByText,
} from "./sessionText.ts";

const NOW = Date.parse("2026-10-22T12:00:00.000Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    projectId: "p",
    branch: null,
    folder: "~/code/p",
    lane: "free",
    request: "Fix the build",
    isRequestCut: false,
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

describe("createdText", () => {
  it("gives the day and time of a session created this year", () => {
    // Arrange
    const created = new Date(2026, 9, 22, 7, 5).toISOString();

    // Act
    const text = createdText(created, NOW);

    // Assert
    expect(text).toBe("créée le 22 oct. à 07:05");
  });

  it("adds the year of a session created an earlier year", () => {
    // Arrange
    const created = new Date(2025, 11, 3, 17, 41).toISOString();

    // Act
    const text = createdText(created, NOW);

    // Assert
    expect(text).toBe("créée le 3 déc. 2025 à 17:41");
  });
});

describe("ageDisplay", () => {
  it("shows the plain age of a fresh open session", () => {
    // Act
    const age = ageDisplay(buildSession({ updatedAt: ago(5) }), NOW);

    // Assert
    expect(age).toEqual({ text: "5 min", isTag: false });
  });

  it("prefixes the age of a finished session with « il y a »", () => {
    // Act
    const age = ageDisplay(buildSession({ state: "job-done", updatedAt: ago(25) }), NOW);

    // Assert
    expect(age).toEqual({ text: "il y a 25 min", isTag: false });
  });

  it("prefers « Archivée » over « Fermée », counted from the archive", () => {
    // Arrange
    const session = buildSession({ isClosed: true, isArchived: true, archivedAt: ago(10), updatedAt: ago(90) });

    // Act
    const age = ageDisplay(session, NOW);

    // Assert
    expect(age).toEqual({ text: "Archivée · 10 min", isTag: true });
  });

  it("shows « Fermée » with the age of a closed session", () => {
    // Act
    const age = ageDisplay(buildSession({ isClosed: true, updatedAt: ago(90) }), NOW);

    // Assert
    expect(age.text).toBe("Fermée · 1 h 30");
  });
});

describe("awaitedOf", () => {
  it("shows a selo session's question the export missed as an answer awaited in the session", () => {
    // Act
    const awaited = awaitedOf(buildSession({ state: "awaiting-answer", question: null }));

    // Assert
    expect(awaited).toMatchObject({ kind: "question", text: "Claude attend ta réponse dans la session" });
  });

  it("gives the question of a session awaiting an answer", () => {
    // Act
    const awaited = awaitedOf(buildSession({ state: "awaiting-answer", question: "A or B?" }));

    // Assert
    expect(awaited).toMatchObject({ kind: "question", text: "A or B?", isCode: false });
  });

  it("gives the commit's subject, and its body in the full text", () => {
    // Act
    const awaited = awaitedOf(buildSession({ state: "awaiting-commit", pendingCommit: { subject: "fix(a): b", body: "Spec: none" } }));

    // Assert
    expect(awaited).toMatchObject({ kind: "commit", text: "fix(a): b", full: "fix(a): b\n\nSpec: none", isCode: true });
  });

  it("gives the tool to allow of a session awaiting a permission", () => {
    // Act
    const awaited = awaitedOf(buildSession({ state: "awaiting-permission", permissionTool: "npm run build && npm test" }));

    // Assert
    expect(awaited).toMatchObject({ kind: "permission", label: "Permission demandée", text: "Autoriser : npm run build && npm test", full: "Autoriser : npm run build && npm test", isCode: true });
  });

  it("says Claude awaits a permission when the transcript names no tool", () => {
    // Act
    const awaited = awaitedOf(buildSession({ state: "awaiting-permission", permissionTool: null }));

    // Assert
    expect(awaited).toMatchObject({ kind: "permission", text: "Claude attend ta permission dans la session", isCode: false });
  });

  it("says « Interrompue » for a stopped session with no error", () => {
    // Act
    const awaited = awaitedOf(buildSession({ state: "stopped", error: null }));

    // Assert
    expect(awaited).toMatchObject({ kind: "error", text: "Interrompue, sans message d’erreur", isCode: false });
  });

  it("gives nothing for a session that waits on nobody", () => {
    // Act, Assert
    expect(awaitedOf(buildSession({ state: "turn-ended" }))).toBeNull();
    expect(calmText(buildSession({ state: "working", step: "stage:2", substep: "tests" }))).toBe("Rien : Claude travaille (étape 2 · tests).");
  });
});

describe("toneOf", () => {
  it.each([
    [{ state: "awaiting-answer" }, "warn"],
    [{ state: "awaiting-permission" }, "warn"],
    [{ state: "awaiting-permission", isClosed: true }, "off"],
    [{ state: "awaiting-commit" }, "warn"],
    [{ state: "stopped" }, "danger"],
    [{ state: "stopped", isClosed: true }, "off"],
    [{ state: "working" }, "pulse"],
    [{ state: "turn-ended" }, "turn"],
    [{ state: "turn-ended", isClosed: true }, "off"],
    [{ state: "job-done" }, "done"],
    [{ state: "job-done", isClosed: true }, "off"],
    [{ state: "job-done", isArchived: true }, "off"],
    [{ state: "working", isArchived: true }, "off"],
  ] as const)("colours %o as %s", (overrides, tone) => {
    // Act, Assert
    expect(toneOf(buildSession(overrides))).toBe(tone);
  });
});

describe("rowContext", () => {
  it("gives what is awaited first, in a session to handle", () => {
    // Act
    const context = rowContext(buildSession({ state: "awaiting-answer", question: "A or B?", nextAction: "/selo:build x" }));

    // Assert
    expect(context).toMatchObject({ kind: "awaited", awaited: { kind: "question", text: "A or B?" } });
  });

  it("gives the step of a working session, capitalised", () => {
    // Act, Assert
    expect(rowContext(buildSession({ state: "working", step: "stage:2", substep: "tests du web" }))).toEqual({ kind: "step", text: "Étape 2 · tests du web" });
  });

  it("gives the next action when nothing is awaited and no step runs", () => {
    // Act, Assert
    expect(rowContext(buildSession({ state: "job-done", nextAction: "/selo:review" }))).toEqual({ kind: "next", command: "/selo:review" });
    expect(rowContext(buildSession({ state: "working", nextAction: "/selo:review" }))).toEqual({ kind: "next", command: "/selo:review" });
  });

  it("gives nothing for an archived session's next action, a closed session's awaited item or a calm session", () => {
    // Act, Assert
    expect(rowContext(buildSession({ state: "job-done", nextAction: "/selo:review", isArchived: true }))).toEqual({ kind: "none" });
    expect(rowContext(buildSession({ state: "awaiting-answer", question: "A?", isClosed: true }))).toEqual({ kind: "none" });
    expect(rowContext(buildSession({ state: "turn-ended" }))).toEqual({ kind: "none" });
  });
});

describe("requestText", () => {
  it("marks a request cut by the export, and names an empty one", () => {
    // Act, Assert
    expect(requestText(buildSession({ request: "Refais le header", isRequestCut: true }))).toBe("Refais le header…");
    expect(requestText(buildSession({ request: "" }))).toBe("Demande non lisible dans l’export");
  });
});

describe("desktopLinkOf", () => {
  const link = "claude://claude.ai/epitaxy/local_62342b42-d46b-4dbb-84d3-5d68c3e1f7e9";

  it("gives the desktop app's link of a desktop-app session", () => {
    expect(desktopLinkOf(buildSession({ desktopLink: link }))).toBe(link);
  });

  it.each([
    ["no link", null],
    ["a javascript: URL", "javascript:alert(1)"],
    ["another host", "claude://evil.example/epitaxy/local_62342b42-d46b-4dbb-84d3-5d68c3e1f7e9"],
    ["a trailing path", `${link}/../x`],
  ])("gives null for %s", (_case, desktopLink) => {
    expect(desktopLinkOf(buildSession({ desktopLink }))).toBeNull();
  });
});

describe("blockers", () => {
  it.each([
    ["not-done", "idle"],
    ["pending-commit", "warn"],
    ["question", "warn"],
    ["dirty-files", "idle"],
    ["background-tasks", "pulse"],
    ["subagents", "pulse"],
  ] as const)("gives %s a label, a hint and the %s tone", (blocker, tone) => {
    expect(blockerLabel(blocker)).toBeTruthy();
    expect(blockerHint(blocker)).toBeTruthy();
    expect(blockerTone(blocker)).toBe(tone);
  });

  it("drops the unfinished work and uncommitted files a pending commit implies, keeping the export's order", () => {
    const s = buildSession({ blockers: ["not-done", "pending-commit", "dirty-files", "subagents"] });
    expect(shownBlockers(s)).toEqual(["pending-commit", "subagents"]);
    expect(closeText(s)).toBe("Pas encore — Commit en attente · Sous-agents actifs");
  });

  it("keeps every blocker when no commit is pending", () => {
    expect(shownBlockers(buildSession({ blockers: ["not-done", "dirty-files"] }))).toEqual(["not-done", "dirty-files"]);
  });
});

describe("sessions outside selo", () => {
  const outside = (overrides: Partial<Session> = {}) => buildSession({ lane: "outside", isOutsideSelo: true, ...overrides });

  it("names their type of work « hors selo », neutral, and keeps the others' labels", () => {
    expect(sessionLaneLabel(outside())).toBe("hors selo");
    expect(sessionLaneLabel(buildSession({ lane: "free" }))).toBe("libre");
    expect(sessionLaneLabel(buildSession({ lane: "build" }))).toBe("build");
  });

  it("says whether they can be closed is unknown, whatever their blockers", () => {
    expect(closeText(outside())).toBe("Inconnu hors selo");
    expect(closeText(buildSession({ blockers: [] }))).toBe("Oui, rien ne bloque");
  });

  it("reads their unknown effort as « — »", () => {
    expect(modelText(outside({ model: "claude-opus-5-5" }))).toBe("claude-opus-5-5 · — tokens · effort —");
    expect(modelText(buildSession({ model: "claude-opus-5-5" }))).toBe("claude-opus-5-5 · — tokens");
  });

  it("puts the session's total tokens, the four kinds summed, next to the model", () => {
    const tokens = { input: 1000, cacheRead: 1_200_000, cacheWrite: 30_000, output: 4567 };
    const s = buildSession({ model: "claude-opus-5-5", effort: "high", usage: { calls: 3, tokens, byModel: [] } });
    expect(modelText(s)).toBe("claude-opus-5-5 · 1,2 M tokens · effort high");
  });

  it("shows a question whose text is unknown as an answer awaited in the session", () => {
    expect(awaitedOf(outside({ state: "awaiting-answer" }))?.text).toBe("Claude attend ta réponse dans la session");
  });
});

describe("changedText", () => {
  const project = (changedCount: number | null) => ({ id: "p", name: "p", branch: null, changedCount });

  it("counts the uncommitted files, or says there is nothing to commit", () => {
    expect(changedText(project(2))).toBe("2 fichiers non commités");
    expect(changedText(project(0))).toBe("rien à commiter");
  });

  it("hides an unknown count", () => {
    expect(changedText(project(null))).toBeNull();
  });
});

describe("writtenByText", () => {
  it("names the plugin version that wrote the session", () => {
    expect(writtenByText(buildSession({ writtenBy: "2.2.1" }))).toBe("selo-ops 2.2.1");
  });

  it("reads « — » when the export gives no version", () => {
    expect(writtenByText(buildSession())).toBe("—");
  });
});

describe("pluginsText", () => {
  it("names each installed plugin with its version", () => {
    expect(
      pluginsText([
        { name: "selo", versions: ["2.2.0"] },
        { name: "selo-ops", versions: ["2.2.1"] },
      ]),
    ).toBe("selo 2.2.0 · selo-ops 2.2.1");
  });

  it("lists every version of a plugin installed at several", () => {
    expect(pluginsText([{ name: "selo", versions: ["2.2.0", "2.1.0"] }])).toBe("selo 2.2.0 / 2.1.0");
  });

  it("gives nothing when no plugin is known", () => {
    expect(pluginsText([])).toBeNull();
  });
});

describe("isPluginOutdated", () => {
  const installed: InstalledPlugin[] = [{ name: "selo-ops", versions: ["2.2.1"] }];

  it("warns when the session was written by another version than the installed one", () => {
    expect(isPluginOutdated(buildSession({ writtenBy: "2.1.0" }), installed)).toBe(true);
  });

  it("stays quiet on an installed version, whichever of several", () => {
    expect(isPluginOutdated(buildSession({ writtenBy: "2.2.1" }), installed)).toBe(false);
    expect(isPluginOutdated(buildSession({ writtenBy: "2.1.0" }), [{ name: "selo-ops", versions: ["2.2.1", "2.1.0"] }] satisfies InstalledPlugin[])).toBe(false);
  });

  it("stays quiet with no version in the export or no selo-ops installed", () => {
    expect(isPluginOutdated(buildSession(), installed)).toBe(false);
    expect(isPluginOutdated(buildSession({ writtenBy: "2.1.0" }), [{ name: "selo", versions: ["2.2.0"] }] satisfies InstalledPlugin[])).toBe(false);
  });
});
