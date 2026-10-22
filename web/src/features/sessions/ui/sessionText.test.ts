import { describe, expect, it } from "vitest";
import type { Session } from "../data/sessionView.ts";
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
  laneTone,
  modelText,
  requestText,
  sessionLaneLabel,
  shownBlockers,
  toneOf,
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
    touchedFiles: [],
    desktopLink: null,
    isOutsideSelo: false,
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
    expect(age).toEqual({ text: "5 min", isTag: false, isStale: false });
  });

  it("tags an open session without news for 30 min", () => {
    // Act
    const age = ageDisplay(buildSession({ updatedAt: ago(45) }), NOW);

    // Assert
    expect(age).toEqual({ text: "Sans nouvelles depuis 45 min", isTag: true, isStale: true });
  });

  it("prefers « Archivée » over « Fermée », counted from the archive", () => {
    // Arrange
    const session = buildSession({ isClosed: true, isArchived: true, archivedAt: ago(10), updatedAt: ago(90) });

    // Act
    const age = ageDisplay(session, NOW);

    // Assert
    expect(age).toEqual({ text: "Archivée · 10 min", isTag: true, isStale: false });
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
    expect(awaited).toMatchObject({ kind: "permission", key: "Permission", label: "Permission demandée", text: "Autoriser : npm run build && npm test", full: "Autoriser : npm run build && npm test", isCode: true });
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
    [{ state: "awaiting-permission", isClosed: true }, "idle"],
    [{ state: "awaiting-commit" }, "warn"],
    [{ state: "stopped" }, "danger"],
    [{ state: "stopped", isClosed: true }, "idle"],
    [{ state: "working" }, "pulse"],
    [{ state: "turn-ended" }, "idle"],
    [{ state: "job-done" }, "hollow"],
  ] as const)("colours %o as %s", (overrides, tone) => {
    // Act, Assert
    expect(toneOf(buildSession(overrides))).toBe(tone);
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

describe("laneTone", () => {
  it("gives libre, fastlane and autopilot their own colour", () => {
    expect(laneTone("free")).toBe("free");
    expect(laneTone("fastlane")).toBe("fastlane");
    expect(laneTone("autopilot")).toBe("autopilot");
  });

  it("leaves the other lanes neutral", () => {
    expect(laneTone("build")).toBeNull();
    expect(laneTone("blueprint")).toBeNull();
  });
});

describe("sessions outside selo", () => {
  const outside = (overrides: Partial<Session> = {}) => buildSession({ lane: "outside", isOutsideSelo: true, ...overrides });

  it("names their type of work « hors selo », neutral, and keeps the others' labels", () => {
    expect(sessionLaneLabel(outside())).toBe("hors selo");
    expect(laneTone(outside().lane)).toBeNull();
    expect(sessionLaneLabel(buildSession({ lane: "free" }))).toBe("libre");
    expect(sessionLaneLabel(buildSession({ lane: "build" }))).toBe("build");
  });

  it("says whether they can be closed is unknown, whatever their blockers", () => {
    expect(closeText(outside())).toBe("Inconnu hors selo");
    expect(closeText(buildSession({ blockers: [] }))).toBe("Oui, rien ne bloque");
  });

  it("reads their unknown effort as « — »", () => {
    expect(modelText(outside({ model: "claude-opus-5-5" }))).toBe("claude-opus-5-5 · effort —");
    expect(modelText(buildSession({ model: "claude-opus-5-5" }))).toBe("claude-opus-5-5");
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
