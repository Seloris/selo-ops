import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// Claude Code writes one status file per running process in `{config dir}/sessions/{pid}.json`; a process started by
// the desktop app names there the app's own session (`hostSessionId`), which no session log nor the ops export holds.
// The file goes when the process ends: the link is kept in the database from the first read (`session` BR-11).

export const DESKTOP_ENTRYPOINT = "claude-desktop";

const DESKTOP_SESSION_ID = /^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const statusFileSchema = z.object({
  sessionId: z.string(),
  entrypoint: z.string().nullish(),
  hostSessionId: z.string().nullish(),
});

export type ClaudeStatusFile = z.infer<typeof statusFileSchema>;

export interface DesktopSessionReader {
  // The desktop app's session id of each running desktop-app session, by Claude Code session id.
  read(): Map<string, string>;
}

export function desktopSessionIdOf(status: ClaudeStatusFile): string | null {
  const id = status.hostSessionId;
  return status.entrypoint === DESKTOP_ENTRYPOINT && id != null && DESKTOP_SESSION_ID.test(id) ? id : null;
}

// Built only from a checked id: the page opens this string as a link.
export function toDesktopLink(desktopSessionId: string | undefined): string | null {
  return desktopSessionId !== undefined && DESKTOP_SESSION_ID.test(desktopSessionId)
    ? `claude://claude.ai/epitaxy/${desktopSessionId}`
    : null;
}

export function createDesktopSessionReader(statusDir: string): DesktopSessionReader {
  return {
    read: () => {
      const ids = new Map<string, string>();
      let names: string[];
      try {
        // `*.json` only: the folder also holds `{pid}.{hash}.key` files.
        names = readdirSync(statusDir).filter((name) => name.endsWith(".json"));
      } catch {
        return ids;
      }
      for (const name of names) {
        try {
          const parsed = statusFileSchema.safeParse(JSON.parse(readFileSync(join(statusDir, name), "utf8")));
          const id = parsed.success ? desktopSessionIdOf(parsed.data) : null;
          if (parsed.success && id !== null) ids.set(parsed.data.sessionId, id);
        } catch {
          // unreadable or half-written: skipped until the next read
        }
      }
      return ids;
    },
  };
}
