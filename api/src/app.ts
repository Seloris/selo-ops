import express from "express";
import type { Database } from "./db/client.js";
import { healthRoutes } from "./features/health/health.routes.js";
import { createDesktopSessionReader } from "./features/sessions/sessions.desktop.js";
import { createOpsExportReader } from "./features/sessions/sessions.export.js";
import { createDesktopSessionLinkRepository, createSessionArchiveRepository } from "./features/sessions/sessions.repository.js";
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
}

// No sign-in: a local dashboard of the developer's own sessions, every route is public.
export function createApp({ db, clock, opsDir, claudeSessionsDir }: AppContext) {
  const app = express();
  app.use(express.json());
  app.use(healthRoutes({ clock }));
  const sessions = createSessionService({
    opsExport: createOpsExportReader(opsDir),
    archives: createSessionArchiveRepository(db),
    desktopSessions: createDesktopSessionReader(claudeSessionsDir),
    desktopLinks: createDesktopSessionLinkRepository(db),
    clock,
  });
  app.use(sessionsRoutes({ sessions }));
  app.use(errorHandler);
  return app;
}
