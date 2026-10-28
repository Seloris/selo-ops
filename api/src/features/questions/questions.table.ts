import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// A question asked of a project and its answer: Selo Ops' own data, kept until the person deletes it (`question` BR-06).
export const questions = pgTable("questions", {
  id: text().primaryKey(),
  projectId: text().notNull(),
  // `blueprint`, `sheet`, `specs` for all the specs or `project` for the whole project (then `path` is null).
  targetKind: text().notNull(),
  path: text(),
  // `explain`; null for a free text.
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
  // The run's tokens by kind, all its models together (`question` BR-04); null for an answer kept without them.
  inputTokens: integer(),
  cacheReadTokens: integer(),
  cacheWriteTokens: integer(),
  outputTokens: integer(),
  // The Claude Code session id of its run, given by Selo Ops: the run is never listed as a session (`session` BR-12).
  runSessionId: text().notNull(),
  askedAt: timestamp({ withTimezone: true }).notNull(),
  answeredAt: timestamp({ withTimezone: true }),
});

export type Question = typeof questions.$inferSelect;
