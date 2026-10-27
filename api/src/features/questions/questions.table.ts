import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// A question asked of a project and its answer: Selo Ops' own data, kept until the person deletes it (`question` BR-06).
export const questions = pgTable("questions", {
  id: text().primaryKey(),
  projectId: text().notNull(),
  // `blueprint`, `sheet`, or `project` for the whole project (then `path` is null).
  targetKind: text().notNull(),
  path: text(),
  // `explain` or `summary`; null for a free text.
  preset: text(),
  text: text(),
  // `running`, `answered` or `failed` (`question` BR-04).
  state: text().notNull(),
  answer: text(),
  // `interrupted`, `timeout`, `missing-binary` or `run-failed`.
  error: text(),
  errorDetail: text(),
  model: text(),
  durationMs: integer(),
  // The Claude Code session id of its run, given by Selo Ops: the run is never listed as a session (`session` BR-12).
  runSessionId: text().notNull(),
  askedAt: timestamp({ withTimezone: true }).notNull(),
  answeredAt: timestamp({ withTimezone: true }),
});

export type Question = typeof questions.$inferSelect;
