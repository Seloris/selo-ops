import { z } from "zod";
import { problemDetailsSchema } from "../../shared/errors.js";
import { registry } from "../../shared/openapi.js";
import { PHASES } from "./sessions.export.js";

export const sessionStateSchema = z.enum(PHASES).meta({ id: "SessionState" });

export const closeBlockerSchema = z
  .enum(["not-done", "pending-commit", "question", "dirty-files", "background-tasks", "subagents"])
  .meta({ id: "CloseBlocker" });

const commitSchema = z.object({ sha: z.string(), subject: z.string() });

export const sessionSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    branch: z.string().nullable(),
    folder: z.string(),
    lane: z.string(),
    request: z.string(),
    isRequestCut: z.boolean(),
    blueprint: z.string().nullable(),
    step: z.string().nullable(),
    substep: z.string().nullable(),
    state: sessionStateSchema,
    isClosed: z.boolean(),
    isArchived: z.boolean(),
    archivedAt: z.iso.datetime().nullable(),
    canArchive: z.boolean(),
    question: z.string().nullable(),
    pendingCommit: z.object({ subject: z.string(), body: z.string() }).nullable(),
    error: z.string().nullable(),
    recap: z.string().nullable(),
    commits: z.array(commitSchema),
    nextAction: z.string().nullable(),
    model: z.string().nullable(),
    effort: z.string().nullable(),
    permissionMode: z.string().nullable(),
    blockers: z.array(closeBlockerSchema),
    subagents: z.array(z.object({ type: z.string(), task: z.string().nullable(), state: sessionStateSchema })),
    touchedFiles: z.array(z.string()),
    // `claude://claude.ai/epitaxy/local_{uuid}`, opening the session in the Claude desktop app; null for a session
    // the desktop app did not start, or that Selo Ops never saw running (`session` BR-11).
    desktopLink: z.string().nullable(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "Session" });

export const projectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    branch: z.string().nullable(),
    changedCount: z.number().int(),
  })
  .meta({ id: "Project" });

export const sessionsResponseSchema = z.object({
  sessions: z.array(sessionSchema),
  projects: z.array(projectSchema),
});

export const sessionParamsSchema = z.object({ id: z.string().min(1) });

export type Session = z.infer<typeof sessionSchema>;
export type Project = z.infer<typeof projectSchema>;
export type SessionsResponse = z.infer<typeof sessionsResponseSchema>;
export type CloseBlocker = z.infer<typeof closeBlockerSchema>;

const problem = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: problemDetailsSchema } },
});

registry.registerPath({
  method: "get",
  path: "/v1/sessions",
  summary: "Every session of the ops export, with its derived state, and their projects",
  responses: {
    200: { description: "The sessions and projects", content: { "application/json": { schema: sessionsResponseSchema } } },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/sessions/{id}/archive",
  summary: "Archive a session whose current run is done",
  request: { params: sessionParamsSchema },
  responses: {
    204: { description: "Archived" },
    404: problem("The session is not in the export"),
    422: problem("The session's current run is not done (code session_not_done)"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/sessions/{id}/archive",
  summary: "Unarchive a session",
  request: { params: sessionParamsSchema },
  responses: {
    204: { description: "Back in the list" },
    404: problem("The session is not in the export"),
  },
});
