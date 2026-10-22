import { describe, expect, it } from "vitest";
import type { Session } from "../data/sessionView.ts";
import { ageDisplay, awaitedOf, calmText, requestText, toneOf } from "./sessionText.ts";

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
    updatedAt: ago(1),
    ...overrides,
  };
}

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
