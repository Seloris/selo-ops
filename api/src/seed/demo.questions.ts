import { randomUUID } from "node:crypto";
import type { Database } from "../db/client.js";
import { createQuestionRepository } from "../features/questions/questions.repository.js";
import { RunError, type QuestionRunner } from "../features/questions/questions.runner.js";
import type { Question } from "../features/questions/questions.table.js";

// The demo never starts Claude Code: its runner answers a canned text after 3 s.
const DEMO_ANSWER_DELAY_MS = 3000;
const DEMO_MODEL = "claude-sonnet-5-5";

const CANNED_ANSWER = [
  "**En bref :** ce fichier décrit ce que la page doit faire, zone par zone.",
  "",
  "- Chaque exigence (`FR`) est une phrase vérifiable.",
  "- Les règles métier (`BR`) vivent dans les fiches de domaine et sont citées ici.",
  "- Les questions ouvertes attendent une décision de la personne.",
].join("\n");

export function createDemoQuestionRunner(delayMs = DEMO_ANSWER_DELAY_MS): QuestionRunner {
  return {
    run: ({ signal }) =>
      new Promise((resolve, reject) => {
        const onAbort = () => {
          clearTimeout(timer);
          reject(new RunError("run-failed", "stopped"));
        };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", onAbort);
          resolve({ answer: CANNED_ANSWER, model: DEMO_MODEL, durationMs: delayMs });
        }, delayMs);
        signal.addEventListener("abort", onAbort, { once: true });
      }),
  };
}

// The questions the browser tests read: an answered and a failed one on a blueprint, an answered one on the project.
export async function seedQuestions(db: Database, now: number, projectId: string): Promise<void> {
  const repo = createQuestionRepository(db);
  const at = (secondsAgo: number) => new Date(now - secondsAgo * 1000);
  const base = { projectId, error: null, errorDetail: null, preset: null, text: null, answer: null, model: null, durationMs: null };
  const rows: Question[] = [
    {
      ...base, id: randomUUID(), runSessionId: randomUUID(), targetKind: "blueprint", path: ".planning/blueprints/2026-10-20-monthly-balance.md",
      preset: "summary", state: "answered", model: DEMO_MODEL, durationMs: 41_000, askedAt: at(3 * 3600), answeredAt: at(3 * 3600 - 41),
      answer: "- Un solde mensuel par compte : solde d'ouverture, débits, crédits, solde de clôture.\n- Deux étapes : `api` puis `web`.\n- La TVA reste arrondie par ligne (`invoice` BR-04).",
    },
    {
      ...base, id: randomUUID(), runSessionId: randomUUID(), targetKind: "blueprint", path: ".planning/blueprints/2026-10-20-monthly-balance.md",
      text: "Pourquoi deux étapes et pas une seule ?", state: "failed", error: "run-failed", errorDetail: "API Error: 529 Overloaded",
      askedAt: at(2 * 3600), answeredAt: at(2 * 3600 - 12),
    },
    {
      ...base, id: randomUUID(), runSessionId: randomUUID(), targetKind: "project", path: null,
      text: "Quelles pages restent sans spec ?", state: "answered", model: DEMO_MODEL, durationMs: 73_000, askedAt: at(5 * 3600), answeredAt: at(5 * 3600 - 73),
      answer: "Toutes les pages ont une spec. **Monthly balance** vient d'être amorcée (`docs(balance): bootstrap spec`) et ne compte qu'une exigence.",
    },
  ];
  for (const row of rows) await repo.insert(row);
}
