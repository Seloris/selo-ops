import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { desktopSessionLinks, sessionArchives, sessionNotes, type DesktopSessionLink, type SessionArchive, type SessionNote } from "./sessions.table.js";

export interface SessionArchiveRepository {
  list(): Promise<SessionArchive[]>;
  save(archive: SessionArchive): Promise<void>;
  remove(sessionId: string): Promise<void>;
}

export function createSessionArchiveRepository(db: Database): SessionArchiveRepository {
  return {
    list: () => db.select().from(sessionArchives),
    save: async (archive) => {
      await db
        .insert(sessionArchives)
        .values(archive)
        .onConflictDoUpdate({ target: sessionArchives.sessionId, set: { runId: archive.runId, archivedAt: archive.archivedAt } });
    },
    remove: async (sessionId) => {
      await db.delete(sessionArchives).where(eq(sessionArchives.sessionId, sessionId));
    },
  };
}

export interface DesktopSessionLinkRepository {
  list(): Promise<DesktopSessionLink[]>;
  saveMany(links: DesktopSessionLink[]): Promise<void>;
}

export function createDesktopSessionLinkRepository(db: Database): DesktopSessionLinkRepository {
  return {
    list: () => db.select().from(desktopSessionLinks),
    saveMany: async (links) => {
      if (links.length === 0) return;
      await db
        .insert(desktopSessionLinks)
        .values(links)
        .onConflictDoUpdate({ target: desktopSessionLinks.sessionId, set: { desktopSessionId: sql`excluded.desktop_session_id` } });
    },
  };
}

export interface SessionNoteRepository {
  list(): Promise<SessionNote[]>;
  save(note: SessionNote): Promise<void>;
  remove(sessionId: string): Promise<void>;
}

export function createSessionNoteRepository(db: Database): SessionNoteRepository {
  return {
    list: () => db.select().from(sessionNotes),
    save: async (note) => {
      await db
        .insert(sessionNotes)
        .values(note)
        .onConflictDoUpdate({ target: sessionNotes.sessionId, set: { text: note.text, updatedAt: note.updatedAt } });
    },
    remove: async (sessionId) => {
      await db.delete(sessionNotes).where(eq(sessionNotes.sessionId, sessionId));
    },
  };
}
