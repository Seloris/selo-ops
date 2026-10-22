import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Selo Ops' own data: the ops export is read-only, so an archive lives here, tied to the run it was made on.
export const sessionArchives = pgTable("session_archives", {
  sessionId: text().primaryKey(),
  runId: text().notNull(),
  archivedAt: timestamp({ withTimezone: true }).notNull(),
});

export type SessionArchive = typeof sessionArchives.$inferSelect;

// The desktop app's session behind a Claude Code session, kept once seen: Claude Code's status file that names it
// goes when the process ends (`session` BR-11).
export const desktopSessionLinks = pgTable("desktop_session_links", {
  sessionId: text().primaryKey(),
  desktopSessionId: text().notNull(),
});

export type DesktopSessionLink = typeof desktopSessionLinks.$inferSelect;
