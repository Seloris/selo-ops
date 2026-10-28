import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { questions, type Question } from "./questions.table.js";

export type QuestionOutcome = Pick<
  Question,
  "state" | "answer" | "error" | "errorDetail" | "model" | "durationMs" | "inputTokens" | "cacheReadTokens" | "cacheWriteTokens" | "outputTokens" | "answeredAt"
>;

// One file's questions, or those on all the specs or on the whole project.
export type QuestionScope = { path: string } | { kind: "specs" | "project" };

export interface QuestionRepository {
  // Newest first.
  list(projectId: string, scope: QuestionScope): Promise<Question[]>;
  find(id: string): Promise<Question | undefined>;
  insert(question: Question): Promise<void>;
  // Only a question still running: one deleted meanwhile stays deleted.
  finish(id: string, outcome: QuestionOutcome): Promise<void>;
  remove(id: string): Promise<void>;
  // The session ids of every question's run, kept out of the sessions outside selo (`session` BR-12).
  runSessionIds(): Promise<Set<string>>;
  // At start-up: a run cut by Selo Ops stopping (`question` BR-04).
  interruptRunning(at: Date): Promise<void>;
}

export function createQuestionRepository(db: Database): QuestionRepository {
  return {
    list: (projectId, scope) =>
      db
        .select()
        .from(questions)
        .where(
          and(
            eq(questions.projectId, projectId),
            "path" in scope ? eq(questions.path, scope.path) : and(isNull(questions.path), eq(questions.targetKind, scope.kind)),
          ),
        )
        .orderBy(desc(questions.askedAt)),
    find: async (id) => (await db.select().from(questions).where(eq(questions.id, id)))[0],
    insert: async (question) => {
      await db.insert(questions).values(question);
    },
    finish: async (id, outcome) => {
      await db
        .update(questions)
        .set(outcome)
        .where(and(eq(questions.id, id), eq(questions.state, "running")));
    },
    remove: async (id) => {
      await db.delete(questions).where(eq(questions.id, id));
    },
    runSessionIds: async () => new Set((await db.select({ id: questions.runSessionId }).from(questions)).map((r) => r.id)),
    interruptRunning: async (at) => {
      await db.update(questions).set({ state: "failed", error: "interrupted", answeredAt: at }).where(eq(questions.state, "running"));
    },
  };
}
