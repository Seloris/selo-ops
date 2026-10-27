import { describe, expect, it } from "vitest";
import type { Question } from "../data/useQuestions.ts";
import { answerMeta, askErrorText, failureText, questionTitle, stateText, textCheck } from "./questions.ts";

const question = (overrides: Partial<Question> = {}): Question => ({
  id: "q1",
  projectId: "p1",
  targetKind: "blueprint",
  path: ".planning/blueprints/2026-01-01-due-date.md",
  preset: null,
  text: "Pourquoi ?",
  state: "running",
  answer: null,
  error: null,
  errorDetail: null,
  model: null,
  durationMs: null,
  askedAt: "2026-01-01T00:00:00.000Z",
  answeredAt: null,
  ...overrides,
});

const age = (ms: number) => `${Math.floor(ms / 1000)} s`;
const NOW = Date.parse("2026-01-01T00:00:12.000Z");

describe("textCheck", () => {
  it("refuses an empty or blank text", () => {
    expect([textCheck(""), textCheck("   ")].map((c) => c.isSendable)).toEqual([false, false]);
  });

  it("accepts up to 2000 characters, trimmed, and refuses one more", () => {
    expect(textCheck(` ${"a".repeat(2000)} `)).toEqual({ count: 2000, isSendable: true, isTooLong: false });
    expect(textCheck("a".repeat(2001))).toEqual({ count: 2001, isSendable: false, isTooLong: true });
  });
});

describe("questionTitle", () => {
  it("gives a preset's name, else the text", () => {
    expect(questionTitle(question({ preset: "explain", text: null }))).toBe("Explique-moi vite");
    expect(questionTitle(question({ preset: "summary", text: null }))).toBe("Résume");
    expect(questionTitle(question())).toBe("Pourquoi ?");
  });
});

describe("stateText", () => {
  it("gives « En cours » with the time elapsed since it was asked", () => {
    expect(stateText(question(), NOW, age)).toBe("En cours · 12 s");
  });

  it("gives « Répondu » and « Échec »", () => {
    expect(stateText(question({ state: "answered" }), NOW, age)).toBe("Répondu");
    expect(stateText(question({ state: "failed" }), NOW, age)).toBe("Échec");
  });
});

describe("failureText", () => {
  it("says « Interrompue » for a run cut by Selo Ops stopping", () => {
    expect(failureText(question({ state: "failed", error: "interrupted" }))).toBe("Interrompue");
  });

  it("adds Claude Code's own words", () => {
    expect(failureText(question({ state: "failed", error: "run-failed", errorDetail: "API Error: 529" }))).toBe("La réponse a échoué : API Error: 529");
  });
});

describe("askErrorText", () => {
  it("says why a question was refused, in French", () => {
    expect(askErrorText(409)).toBe("3 questions sont déjà en cours : réessayez dans un moment.");
    expect(askErrorText(404)).toBe("Ce fichier n’est plus dans le projet.");
    expect(askErrorText(null)).toBe("Selo Ops ne répond pas.");
  });
});

describe("answerMeta", () => {
  it("gives the model and the duration", () => {
    expect(answerMeta(question({ state: "answered", model: "claude-sonnet-5-5", durationMs: 41_000 }), age)).toBe("claude-sonnet-5-5 · 41 s");
  });
});
