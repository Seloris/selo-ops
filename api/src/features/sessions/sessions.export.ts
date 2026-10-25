import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { createImagePromptReader, createTranscriptStartReader } from "./sessions.transcript.js";

// The files the selo plugin's hooks write (its scripts/ops.mjs, schema version 1). Only the fields this
// application reads are declared; a file that does not match is skipped, never fatal.

export const PHASES = ["awaiting-answer", "awaiting-commit", "stopped", "working", "turn-ended", "job-done"] as const;

const commitSchema = z.object({ sha: z.string(), subject: z.string() });

// `session` BR-18: what a run, or the whole session, consumed. Read leniently: a usage that does not match becomes null,
// never a reason to skip the file; a run before its first stop has no `usage` key at all.
const tokensSchema = z.object({ input: z.number(), cacheRead: z.number(), cacheWrite: z.number(), output: z.number() });
const usageFields = {
  calls: z.number(),
  tokens: tokensSchema,
  byModel: z.array(z.object({ model: z.string(), calls: z.number(), tokens: tokensSchema })),
};
const usageSchema = z.object(usageFields);
const runUsageSchema = z.object({
  ...usageFields,
  tools: z.array(z.object({ name: z.string(), count: z.number() })),
  // `how` kept as any string: a way of loading a later export adds stays readable.
  skills: z.array(z.object({ name: z.string(), count: z.number(), how: z.string() })),
  prompts: z.array(z.object({ at: z.string().nullable(), calls: z.number(), tokens: tokensSchema })),
  settled: z.boolean(),
  partial: z.boolean(),
});

// Each item parsed on its own: one that does not match is dropped, never its siblings nor the file.
const lenientArray = <T>(item: z.ZodType<T>) =>
  z
    .array(z.unknown())
    .nullish()
    .catch(null)
    .transform((items) => (items ?? []).flatMap((i) => {
      const parsed = item.safeParse(i);
      return parsed.success ? [parsed.data] : [];
    }));

// `session` BR-22: one entry at each change of the run's skill, step, substep or phase.
const trailEntrySchema = z.object({
  at: z.iso.datetime(),
  skill: z.string().nullable(),
  step: z.string().nullable(),
  substep: z.string().nullable(),
  phase: z.enum(PHASES),
});

const nextStepSchema = z.object({ text: z.string(), prompt: z.string() });

const runSchema = z.object({
  id: z.string(),
  agentId: z.string().nullish(),
  flow: z.string().nullish(),
  skill: z.string().nullish(),
  // `session` BR-22: the prompt's option, `iterate` (a fastlane's iterate mode) or `autonomous` (a pilot's), else null.
  mode: z.string().nullish(),
  // sessions-live FR-48: the `Next:` lines of the run's done footer, in order.
  next: lenientArray(nextStepSchema),
  trail: lenientArray(trailEntrySchema),
  trailCut: z.boolean().nullish().catch(null),
  request: z.string().nullish(),
  task: z.string().nullish(),
  blueprint: z.string().nullish(),
  step: z.string().nullish(),
  substep: z.string().nullish(),
  error: z.string().nullish(),
  phase: z.enum(PHASES),
  pendingCommit: z.object({ subject: z.string(), body: z.string().nullish() }).nullish(),
  question: z.string().nullish(),
  recap: z.object({ text: z.string().nullish(), commits: z.array(commitSchema).nullish() }).nullish(),
  commits: z.array(commitSchema).nullish(),
  resumePrompt: z.string().nullish(),
  usage: runUsageSchema.nullish().catch(null),
  // Where the run's prompt starts in the transcript, in bytes.
  transcriptFrom: z.number().nullish().catch(null),
  since: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const sessionFileSchema = z.object({
  schemaVersion: z.literal(1),
  writtenAt: z.iso.datetime(),
  // The version of the selo-ops plugin that wrote the file; absent from older exports.
  writtenBy: z.string().nullish().catch(null),
  sessionId: z.string(),
  root: z.string(),
  rootKey: z.string(),
  repo: z.string().nullish(),
  status: z.string(),
  transcriptPath: z.string().nullish(),
  model: z.string().nullish(),
  permissionMode: z.string().nullish(),
  effort: z.string().nullish(),
  touchedFiles: z.array(z.string()).nullish(),
  close: z.object({ ok: z.boolean(), blockers: z.array(z.string()) }).nullish(),
  runs: z.array(runSchema),
  current: runSchema.nullish(),
  // Every run summed, subagents and runs the export dropped included.
  usage: usageSchema.nullish().catch(null),
});

export const BLUEPRINT_STATES = ["draft", "ready", "building", "review", "merging", "done", "legacy"] as const;

const sheetSchema = z.object({
  kind: z.enum(["page", "domain", "app"]),
  slug: z.string(),
  component: z.string().nullish(),
  file: z.string(),
  title: z.string(),
  route: z.string().nullish(),
  ids: z.object({ fr: z.number(), br: z.number(), next: z.object({ fr: z.string(), br: z.string() }) }),
  lastCommit: z.object({ sha: z.string(), subject: z.string(), at: z.string() }).nullish(),
  openBlueprints: z.array(z.string()).nullish(),
});

const blueprintSchema = z.object({
  name: z.string(),
  file: z.string(),
  title: z.string(),
  sheets: z.array(z.string()),
  components: z.array(z.string()),
  state: z.enum(BLUEPRINT_STATES),
  delta: z.array(z.object({ sheet: z.string(), op: z.string(), id: z.string(), text: z.string() })),
  decisions: z.array(z.string()).nullish(),
  stages: z.array(z.object({ number: z.number(), component: z.string(), commit: z.string(), sha: z.string().nullish(), done: z.boolean() })),
  progress: z.object({ reviewDone: z.boolean(), specMerged: z.boolean() }),
  next: z.object({ prompt: z.string() }).nullish().catch(null),
  sessions: z.array(z.string()).nullish().catch(null),
  modifiedAt: z.string().nullish().catch(null),
});

// The fields the projects page reads (`project` BR-01) are read leniently: a mismatch never drops the file sessions read.
export const projectFileSchema = z.object({
  schemaVersion: z.literal(1),
  root: z.string(),
  repo: z.string().nullish(),
  branch: z.string().nullish(),
  changedCount: z.number().nullish(),
  manifest: z.object({ name: z.string() }).nullish(),
  selo: z.string().nullish().catch(null),
  baseBranch: z.string().nullish().catch(null),
  aheadCount: z.number().nullish().catch(null),
  unpushedCount: z.number().nullish().catch(null),
  error: z.string().nullish().catch(null),
  sheets: lenientArray(sheetSchema),
  blueprints: lenientArray(blueprintSchema),
});

export type ExportRun = z.infer<typeof runSchema>;
export type ExportTrailEntry = z.infer<typeof trailEntrySchema>;
export type ExportUsage = z.infer<typeof usageSchema>;
export type ExportRunUsage = z.infer<typeof runUsageSchema>;
export type SessionFile = z.infer<typeof sessionFileSchema>;
export type ProjectFile = z.infer<typeof projectFileSchema>;
// What a test or the demo writes: the planning fields may be left out, as an older export does.
export type ProjectFileInput = z.input<typeof projectFileSchema>;
export type ExportSheet = z.infer<typeof sheetSchema>;
export type ExportBlueprint = z.infer<typeof blueprintSchema>;

export interface OpsExport {
  sessions: SessionFile[];
  projects: ProjectFile[];
  // Sessions whose file stays but whose transcript is gone: out of `sessions`, yet still the export's (`session` BR-14).
  deletedSessionIds: Set<string>;
  // When each session's transcript starts, by session id: only the sessions whose transcript gives a date.
  transcriptStarts: Map<string, number>;
  // The main runs whose request is empty because their prompt is an image with no text, by run id (`session` BR-10).
  imageRequestRunIds: Set<string>;
}

export interface OpsExportReader {
  read(): OpsExport;
}

// `*.json` only: the plugin writes `{file}.{pid}.tmp` first and renames it, and may leave one behind.
function readFolder<T>(dir: string, schema: z.ZodType<T>): T[] {
  let names: string[];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
  const files: T[] = [];
  for (const name of names) {
    try {
      const parsed = schema.safeParse(JSON.parse(readFileSync(join(dir, name), "utf8")));
      if (parsed.success) files.push(parsed.data);
    } catch {
      // unreadable or half-written: skipped until the next write
    }
  }
  return files;
}

// `session` BR-14: deleting a session in Claude Code, or its cleanup of old transcripts, removes the transcript
// but runs no hook, so the file stays as it was; a file that names no transcript is kept.
const isTranscriptGone = (file: SessionFile) => file.transcriptPath != null && !existsSync(file.transcriptPath);

export function createOpsExportReader(opsDir: string): OpsExportReader {
  const transcriptStartOf = createTranscriptStartReader();
  const isImagePrompt = createImagePromptReader();
  return {
    read: () => {
      const files = readFolder(join(opsDir, "sessions"), sessionFileSchema);
      const deleted = files.filter(isTranscriptGone);
      const sessions = files.filter((file) => !deleted.includes(file));
      const transcriptStarts = new Map<string, number>();
      for (const file of sessions) {
        const start = file.transcriptPath == null ? null : transcriptStartOf(file.transcriptPath);
        if (start !== null) transcriptStarts.set(file.sessionId, start);
      }
      const imageRequestRunIds = new Set<string>();
      for (const file of sessions) {
        const path = file.transcriptPath;
        if (path == null) continue;
        for (const run of file.runs) {
          if (!run.agentId && !run.request && run.transcriptFrom != null && isImagePrompt(path, run.transcriptFrom)) imageRequestRunIds.add(run.id);
        }
      }
      return {
        sessions,
        projects: readFolder(join(opsDir, "projects"), projectFileSchema),
        deletedSessionIds: new Set(deleted.map((file) => file.sessionId)),
        transcriptStarts,
        imageRequestRunIds,
      };
    },
  };
}
