import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { createTranscriptStartReader } from "./sessions.transcript.js";

// The files the selo plugin's hooks write (its scripts/ops.mjs, schema version 1). Only the fields this
// application reads are declared; a file that does not match is skipped, never fatal.

export const PHASES = ["awaiting-answer", "awaiting-commit", "stopped", "working", "turn-ended", "job-done"] as const;

const commitSchema = z.object({ sha: z.string(), subject: z.string() });

// Since the plugin's 2.2.0 (`session` BR-18): what a run, or the whole session, consumed. Read leniently: a usage that
// does not match becomes null, never a reason to skip the file; a file written by 1.0.0 has no `usage` key at all.
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

const runSchema = z.object({
  id: z.string(),
  agentId: z.string().nullish(),
  lane: z.string(),
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
  since: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const sessionFileSchema = z.object({
  schemaVersion: z.literal(1),
  writtenAt: z.iso.datetime(),
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

export const projectFileSchema = z.object({
  schemaVersion: z.literal(1),
  root: z.string(),
  repo: z.string().nullish(),
  branch: z.string().nullish(),
  changedCount: z.number().nullish(),
  manifest: z.object({ name: z.string() }).nullish(),
});

export type ExportRun = z.infer<typeof runSchema>;
export type ExportUsage = z.infer<typeof usageSchema>;
export type ExportRunUsage = z.infer<typeof runUsageSchema>;
export type SessionFile = z.infer<typeof sessionFileSchema>;
export type ProjectFile = z.infer<typeof projectFileSchema>;

export interface OpsExport {
  sessions: SessionFile[];
  projects: ProjectFile[];
  // Sessions whose file stays but whose transcript is gone: out of `sessions`, yet still the export's (`session` BR-14).
  deletedSessionIds: Set<string>;
  // When each session's transcript starts, by session id: only the sessions whose transcript gives a date.
  transcriptStarts: Map<string, number>;
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
      return {
        sessions,
        projects: readFolder(join(opsDir, "projects"), projectFileSchema),
        deletedSessionIds: new Set(deleted.map((file) => file.sessionId)),
        transcriptStarts,
      };
    },
  };
}
