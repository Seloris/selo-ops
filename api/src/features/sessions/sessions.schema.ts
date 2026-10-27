import { z } from "zod";
import { problemDetailsSchema } from "../../shared/errors.js";
import { registry } from "../../shared/openapi.js";
import type { ExportRun } from "./sessions.export.js";

type Phase = ExportRun["phase"];

// The export's phases, plus a wait on a permission dialog, which only Claude Code's status file tells (`session` BR-16).
export const SESSION_STATES = [
  "awaiting-answer",
  "awaiting-permission",
  "awaiting-commit",
  "stopped",
  "working",
  "turn-ended",
  "job-done",
] as const satisfies readonly (Phase | "awaiting-permission")[];

export const sessionStateSchema = z.enum(SESSION_STATES).meta({ id: "SessionState" });

export const closeBlockerSchema = z
  .enum(["not-done", "pending-commit", "question", "dirty-files", "background-tasks", "subagents"])
  .meta({ id: "CloseBlocker" });

const commitSchema = z.object({ sha: z.string(), subject: z.string() });

export const trailEntrySchema = z
  .object({ at: z.iso.datetime(), skill: z.string().nullable(), step: z.string().nullable(), substep: z.string().nullable(), phase: sessionStateSchema })
  .meta({ id: "TrailEntry" });

// `session` BR-18: what the export says a session or a run consumed; Selo Ops never counts it.
export const tokensSchema = z
  .object({ input: z.number().int(), cacheRead: z.number().int(), cacheWrite: z.number().int(), output: z.number().int() })
  .meta({ id: "Tokens" });

const usageFields = {
  calls: z.number().int(),
  tokens: tokensSchema,
  // Most tokens first; calls with no model count in the totals only.
  byModel: z.array(z.object({ model: z.string(), calls: z.number().int(), tokens: tokensSchema })),
};

export const usageSchema = z.object(usageFields).meta({ id: "Usage" });

export const runUsageSchema = z
  .object({
    ...usageFields,
    // Most called first; the advisor as `advisor`.
    tools: z.array(z.object({ name: z.string(), count: z.number().int() })),
    // `how`: `tool`, `command` or `preloaded`, any other value a later export may add kept as is.
    skills: z.array(z.object({ name: z.string(), count: z.number().int(), how: z.string() })),
    // The latest 50 prompts of the run, oldest first; `at` null when the transcript gives no time.
    prompts: z.array(z.object({ at: z.string().nullable(), calls: z.number().int(), tokens: tokensSchema })),
    // `session` BR-19: false while the figures may still grow; true when they cover only the transcript's last 32 MB.
    settled: z.boolean(),
    partial: z.boolean(),
  })
  .meta({ id: "RunUsage" });

// `model`: the subagent's real model, the top one of its own usage (`session` BR-20); null with no usage (stopped by Esc).
const subagentSchema = z.object({
  type: z.string(),
  task: z.string().nullable(),
  state: sessionStateSchema,
  // When it started and when the export last saw it: the turn's timeline places it and gives its duration (sessions-live FR-41).
  since: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  model: z.string().nullable(),
  usage: usageSchema.nullable(),
});

export const sessionSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    branch: z.string().nullable(),
    folder: z.string(),
    // `session` BR-22: how the current run is driven (`free`, `fastlane`, `blueprint`, `pilot`) and the selo skill
    // running now, null when none.
    flow: z.string(),
    skill: z.string().nullable(),
    // `session` BR-22: `iterate` for a fastlane run in its iterate mode, `autonomous` for an autonomous pilot, else null.
    mode: z.string().nullable(),
    // sessions-live FR-41: the current run's history, oldest first; empty outside selo and before the run's first change.
    trail: z.array(trailEntrySchema),
    // True once the export dropped the trail's oldest entries.
    isTrailCut: z.boolean(),
    request: z.string(),
    isRequestCut: z.boolean(),
    // `session` BR-10: the request is empty because its prompt is an image with no text; false outside selo.
    isRequestImage: z.boolean(),
    blueprint: z.string().nullable(),
    step: z.string().nullable(),
    substep: z.string().nullable(),
    state: sessionStateSchema,
    isClosed: z.boolean(),
    isArchived: z.boolean(),
    archivedAt: z.iso.datetime().nullable(),
    canArchive: z.boolean(),
    // `session` BR-21: the person's note on the session, null when none.
    note: z.string().nullable(),
    question: z.string().nullable(),
    // `awaiting-permission` only: the shell command to allow, else the tool's name; null when the transcript names none.
    permissionTool: z.string().nullable(),
    pendingCommit: z.object({ subject: z.string(), body: z.string() }).nullable(),
    error: z.string().nullable(),
    recap: z.string().nullable(),
    commits: z.array(commitSchema),
    // sessions-live FR-21: the resume prompt, else the first next step's command.
    nextAction: z.string().nullable(),
    // sessions-live FR-48: the `Next:` lines of the current run's done footer, in order; empty outside selo.
    nextSteps: z.array(z.object({ summary: z.string(), command: z.string() })),
    // `session` BR-20: the export's, else the top model of its latest main run with usage.
    model: z.string().nullable(),
    effort: z.string().nullable(),
    permissionMode: z.string().nullable(),
    blockers: z.array(closeBlockerSchema),
    subagents: z.array(subagentSchema),
    // `session` BR-18: the session's totals, and its current main run's; null for a session outside selo or a run before
    // its first stop.
    usage: usageSchema.nullable(),
    runUsage: runUsageSchema.nullable(),
    // Every main run the export keeps, oldest first: its request, cleaned (`session` BR-10), "" when unreadable, and its
    // usage with what it did (tools, skills, prompts), null before its first stop; its trail and the subagents started
    // before the next main run (sessions-live FR-41), the current run's from the export's freshest copy.
    // Empty for a session outside selo.
    runs: z.array(
      z.object({
        id: z.string(),
        // The session's current run, whose trail is also the session's own.
        isCurrent: z.boolean(),
        // `session` BR-22: `iterate` or `autonomous`, else null.
        mode: z.string().nullable(),
        since: z.iso.datetime(),
        request: z.string(),
        isRequestCut: z.boolean(),
        isRequestImage: z.boolean(),
        usage: runUsageSchema.nullable(),
        trail: z.array(trailEntrySchema),
        isTrailCut: z.boolean(),
        subagents: z.array(subagentSchema),
      }),
    ),
    // True once the export holds its 100 runs, subagents included: the oldest ones may be gone.
    isRunListCut: z.boolean(),
    touchedFiles: z.array(z.string()),
    // `claude://claude.ai/epitaxy/local_{uuid}`, opening the session in the Claude desktop app; null for a session
    // the desktop app did not start, or that Selo Ops never saw running (`session` BR-11).
    desktopLink: z.string().nullable(),
    // A running Claude Code process with no file in the ops export (`session` BR-12): its flow is `free`, and it has no
    // recap, commits, blockers, subagents, files touched, effort nor permissions, which only the export gives.
    isOutsideSelo: z.boolean(),
    // The version of the selo-ops plugin that wrote the session's export file; null outside selo or in an older export.
    writtenBy: z.string().nullable(),
    // `session` BR-15: the first dated line of its transcript, else its oldest run kept, else its process's start.
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "Session" });

export const projectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    branch: z.string().nullable(),
    // Null for a project only sessions outside selo show: its count needs a git process, never run on the poll.
    changedCount: z.number().int().nullable(),
  })
  .meta({ id: "Project" });

// `session` BR-01: a selo plugin Claude Code lists as installed, its distinct versions highest first (several for a
// plugin installed per project at different versions).
export const installedPluginSchema = z
  .object({ name: z.enum(["selo", "selo-ops"]), versions: z.array(z.string()).min(1) })
  .meta({ id: "InstalledPlugin" });

export const sessionsResponseSchema = z.object({
  sessions: z.array(sessionSchema),
  projects: z.array(projectSchema),
  // Empty when Claude Code's list of installed plugins is missing or unreadable.
  plugins: z.array(installedPluginSchema),
});

export const sessionParamsSchema = z.object({ id: z.string().min(1) });

export const NOTE_MAX = 200;
// Trimmed before the length check; an empty text removes the note.
export const noteBodySchema = z.object({ text: z.string().trim().max(NOTE_MAX) });

export const fileDiffQuerySchema = z.object({ file: z.string().min(1).max(1000) });

// A part of a diff, cut at 200 000 characters.
const diffTextSchema = z.object({ diff: z.string(), isCut: z.boolean() });

// What one touched file went through, read from git on a click (`session` BR-01).
export const fileDiffSchema = z
  .object({
    file: z.string(),
    // False when the session's folder is gone or is no git checkout: nothing else is read.
    isAvailable: z.boolean(),
    // The commits the export recorded for the session's runs that change the file, oldest first; `diff` null when git
    // no longer has the commit (a worktree landed, then removed).
    commits: z.array(z.object({ sha: z.string(), subject: z.string(), diff: z.string().nullable(), isCut: z.boolean() })),
    // The file against HEAD, null when unchanged; on a shared checkout it may hold other sessions' edits.
    uncommitted: diffTextSchema.nullable(),
  })
  .meta({ id: "FileDiff" });

// What each touched file went through, summed over the session's recorded commits and its uncommitted part, read from
// git when the person asks for the files (`session` BR-01).
export const fileSummarySchema = z
  .object({
    // False when the session's folder is gone or is no git checkout: nothing else is read.
    isAvailable: z.boolean(),
    // One entry per touched file, in the export's order.
    files: z.array(
      z.object({
        file: z.string(),
        // Deleted when its last part removes it, added when its first part creates it; null when no part changes it.
        status: z.enum(["added", "modified", "deleted"]).nullable(),
        // Null when a part of it is binary.
        added: z.number().int().nullable(),
        removed: z.number().int().nullable(),
        isUncommitted: z.boolean(),
      }),
    ),
  })
  .meta({ id: "FileSummary" });

export type Session = z.infer<typeof sessionSchema>;
export type Project = z.infer<typeof projectSchema>;
export type InstalledPlugin = z.infer<typeof installedPluginSchema>;
export type SessionsResponse = z.infer<typeof sessionsResponseSchema>;
export type SessionState = z.infer<typeof sessionStateSchema>;
export type CloseBlocker = z.infer<typeof closeBlockerSchema>;
export type Usage = z.infer<typeof usageSchema>;
export type FileDiff = z.infer<typeof fileDiffSchema>;
export type FileSummary = z.infer<typeof fileSummarySchema>;

const problem = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: problemDetailsSchema } },
});

registry.registerPath({
  method: "get",
  path: "/v1/sessions",
  summary: "Every session of the ops export and every running session outside selo, with its derived state, and their projects",
  responses: {
    200: { description: "The sessions and projects", content: { "application/json": { schema: sessionsResponseSchema } } },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/sessions/{id}/archive",
  summary: "Archive a session, whatever its state",
  request: { params: sessionParamsSchema },
  responses: {
    204: { description: "Archived" },
    404: problem("The session is neither in the export nor running outside selo"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/sessions/{id}/archive",
  summary: "Unarchive a session",
  request: { params: sessionParamsSchema },
  responses: {
    204: { description: "Back in the list" },
    404: problem("The session is neither in the export nor running outside selo"),
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/sessions/{id}/note",
  summary: "Save the session's note, kept across runs; an empty text removes it",
  request: { params: sessionParamsSchema, body: { content: { "application/json": { schema: noteBodySchema } } } },
  responses: {
    204: { description: "Saved, or removed" },
    400: problem("The text is missing or longer than 200 characters"),
    404: problem("The session is neither in the export nor running outside selo"),
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/sessions/{id}/files",
  summary: "Each file the session touched, with its status and lines added and removed over its recorded commits and its uncommitted part, read from git",
  request: { params: sessionParamsSchema },
  responses: {
    200: { description: "The files, or isAvailable false when the session's folder holds no git checkout", content: { "application/json": { schema: fileSummarySchema } } },
    404: problem("The session is not in the export"),
    502: problem("git did not answer: timed out, missing or killed"),
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/sessions/{id}/diff",
  summary: "The diff of one file the session touched: each recorded commit's part, then the uncommitted part, read from git",
  request: { params: sessionParamsSchema, query: fileDiffQuerySchema },
  responses: {
    200: { description: "The file's diff, or isAvailable false when the session's folder holds no git checkout", content: { "application/json": { schema: fileDiffSchema } } },
    400: problem("The file is missing"),
    404: problem("The session is not in the export, or did not touch the file"),
    502: problem("git did not answer: timed out, missing or killed"),
  },
});
