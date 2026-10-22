import { eq } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { sessionArchives, type SessionArchive } from "./sessions.table.js";

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
