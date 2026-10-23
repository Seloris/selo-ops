import express from "express";
import type { Database } from "./db/client.js";
import { healthRoutes } from "./features/health/health.routes.js";
import { createDesktopSessionReader } from "./features/sessions/sessions.desktop.js";
import { createOpsExportReader } from "./features/sessions/sessions.export.js";
import { createInstalledPluginReader } from "./features/sessions/sessions.plugins.js";
import { createOutsideSessionReader } from "./features/sessions/sessions.outside.js";
import { createDesktopSessionLinkRepository, createSessionArchiveRepository, createSessionNoteRepository } from "./features/sessions/sessions.repository.js";
import { sessionsRoutes } from "./features/sessions/sessions.routes.js";
import { createSessionService } from "./features/sessions/sessions.service.js";
import type { Clock } from "./shared/clock.js";
import { errorHandler } from "./shared/errors.js";

export interface AppContext {
  db: Database;
  clock: Clock;
  // The selo ops export folder, read on each request, never written.
  opsDir: string;
  // Claude Code's status files of running processes, read on each list, never written.
  claudeSessionsDir: string;
  // Claude Code's transcripts, read for the sessions outside selo only, never written.
  claudeProjectsDir: string;
  // Claude Code's list of installed plugins, read on each list for the selo plugins' versions, never written.
  claudePluginsFile: string;
}

// No sign-in: a local dashboard of the developer's own sessions, every route is public.
export function createApp({ db, clock, opsDir, claudeSessionsDir, claudeProjectsDir, claudePluginsFile }: AppContext) {
  const app = express();
  app.use(express.json());
  app.use(healthRoutes({ clock }));
  const sessions = createSessionService({
    opsExport: createOpsExportReader(opsDir),
    outsideSessions: createOutsideSessionReader(claudeSessionsDir, claudeProjectsDir),
    archives: createSessionArchiveRepository(db),
    notes: createSessionNoteRepository(db),
    desktopSessions: createDesktopSessionReader(claudeSessionsDir),
    desktopLinks: createDesktopSessionLinkRepository(db),
    installedPlugins: createInstalledPluginReader(claudePluginsFile),
    clock,
  });
  app.use(sessionsRoutes({ sessions }));
  app.use(errorHandler);
  return app;
}
