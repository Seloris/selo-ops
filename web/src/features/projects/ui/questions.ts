import { t, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import type { Question } from "../data/useQuestions.ts";

// `question` BR-03.
export const QUESTION_TEXT_MAX = 2000;

// projects FR-22: what « Envoyer » checks, on the trimmed text the API keeps.
export function textCheck(text: string): { count: number; isSendable: boolean; isTooLong: boolean } {
  const count = text.trim().length;
  return { count, isSendable: count > 0 && count <= QUESTION_TEXT_MAX, isTooLong: count > QUESTION_TEXT_MAX };
}

const PRESET_KEYS: Record<NonNullable<Question["preset"]>, MessageKey> = {
  explain: "projects.questions.preset.explain",
  summary: "projects.questions.preset.summary",
};

// projects FR-21: its preset's name, else its text.
export const questionTitle = (q: Question) => (q.preset === null ? (q.text ?? "") : t(PRESET_KEYS[q.preset]));

export const presetLabel = (preset: NonNullable<Question["preset"]>) => t(PRESET_KEYS[preset]);

const ERROR_KEYS: Record<NonNullable<Question["error"]>, MessageKey> = {
  interrupted: "projects.questions.error.interrupted",
  timeout: "projects.questions.error.timeout",
  "missing-binary": "projects.questions.error.missingBinary",
  "run-failed": "projects.questions.error.runFailed",
};

// `question` BR-04: « En cours » with the time elapsed, « Répondu », « Échec ».
export function stateText(q: Question, now: number, age: (ms: number) => string): string {
  if (q.state === "running") return t("projects.questions.state.running", { elapsed: age(now - Date.parse(q.askedAt)) });
  return t(q.state === "answered" ? "projects.questions.state.answered" : "projects.questions.state.failed");
}

// The reason of a failed question, with Claude Code's own words when it gave some.
export function failureText(q: Question): string {
  const reason = t(ERROR_KEYS[q.error ?? "run-failed"]);
  return q.errorDetail ? t("projects.questions.error.withDetail", { reason, detail: q.errorDetail }) : reason;
}

// projects FR-22: why a question was not sent; `status` null when Selo Ops did not answer.
export function askErrorText(status: number | null): string {
  if (status === 409) return t("projects.questions.refused.limit");
  if (status === 404) return t("projects.questions.refused.gone");
  if (status === 400) return t("projects.questions.refused.invalid");
  return t("projects.questions.sendErrorUnknown");
}

// An answer's model and duration.
export function answerMeta(q: Question, age: (ms: number) => string): string {
  return [q.model, q.durationMs === null ? null : age(q.durationMs)].filter((x): x is string => x !== null).join(" · ");
}
