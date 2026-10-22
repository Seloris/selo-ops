import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Selo Ops' own data: the ops export is read-only, so an archive lives here, tied to the run it was made on.
export const sessionArchives = pgTable("session_archives", {
  sessionId: text().primaryKey(),
  runId: text().notNull(),
  archivedAt: timestamp({ withTimezone: true }).notNull(),
});

export type SessionArchive = typeof sessionArchives.$inferSelect;
