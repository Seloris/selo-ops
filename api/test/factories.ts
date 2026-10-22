import type { ClaudeStatusFile } from "../src/features/sessions/sessions.desktop.js";
import type { ExportRun, ExportRunUsage, ExportUsage, ProjectFile, SessionFile } from "../src/features/sessions/sessions.export.js";
import type { RunningStatusFile } from "../src/features/sessions/sessions.outside.js";

// One `build{Entity}(overrides)` per entity: the only way a test builds a row.

const EPOCH = "2026-01-01T00:00:00.000Z";
let counter = 0;

const keyOf = (root: string) => root.replace(/[^A-Za-z0-9]/g, "-");

export function buildRun(overrides: Partial<ExportRun> = {}): ExportRun {
  counter += 1;
  return {
    id: `run-${counter}`,
    agentId: null,
    lane: "free",
    request: "Fix the build",
    task: null,
    blueprint: null,
    step: "free",
    substep: null,
    error: null,
    phase: "working",
    pendingCommit: null,
    question: null,
    recap: null,
    commits: [],
    resumePrompt: null,
    since: EPOCH,
    updatedAt: EPOCH,
    ...overrides,
  };
}

// `current` is the session's main run; `runs` defaults to it alone (the export keeps it first).
export function buildSessionFile(overrides: Partial<SessionFile> = {}): SessionFile {
  counter += 1;
  const root = overrides.root ?? "C:/code/ledger-api";
  const current = overrides.current === undefined ? buildRun() : overrides.current;
  return {
    schemaVersion: 1,
    writtenAt: EPOCH,
    sessionId: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    root,
    rootKey: keyOf(root),
    repo: `${root}/.git`,
    status: "live",
    model: "claude-opus-5-5",
    permissionMode: "auto",
    effort: "high",
    touchedFiles: [],
    close: { ok: false, blockers: ["not-done"] },
    runs: current ? [current] : [],
    ...overrides,
    current,
  };
}

export function buildTokens(overrides: Partial<ExportRunUsage["tokens"]> = {}): ExportRunUsage["tokens"] {
  return { input: 1200, cacheRead: 340000, cacheWrite: 21000, output: 8800, ...overrides };
}

// A session's totals, as the export sums them over every run.
export function buildUsage(overrides: Partial<ExportUsage> = {}): ExportUsage {
  const tokens = overrides.tokens ?? buildTokens();
  return { calls: 42, tokens, byModel: [{ model: "claude-opus-5-5", calls: 42, tokens }], ...overrides };
}

// A run's usage, settled and read whole, with one prompt.
export function buildRunUsage(overrides: Partial<ExportRunUsage> = {}): ExportRunUsage {
  const tokens = overrides.tokens ?? buildTokens();
  return {
    calls: 12,
    tokens,
    byModel: [{ model: "claude-opus-5-5", calls: 12, tokens }],
    tools: [{ name: "Read", count: 9 }, { name: "advisor", count: 1 }],
    skills: [{ name: "selo:build", count: 1, how: "command" }],
    prompts: [{ at: EPOCH, calls: 12, tokens }],
    settled: true,
    partial: false,
    ...overrides,
  };
}

export function buildProjectFile(overrides: Partial<ProjectFile> = {}): ProjectFile {
  const root = overrides.root ?? "C:/code/ledger-api";
  return {
    schemaVersion: 1,
    root,
    repo: `${root}/.git`,
    branch: "main",
    changedCount: 0,
    manifest: { name: "ledger-api" },
    ...overrides,
  };
}

// A status file Claude Code writes for a running process, as the desktop app starts it.
export function buildStatusFile(overrides: Partial<ClaudeStatusFile> = {}): ClaudeStatusFile {
  counter += 1;
  return {
    sessionId: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    entrypoint: "claude-desktop",
    hostSessionId: null,
    ...overrides,
  };
}

// A status file of a running process outside selo: this test process's own pid, so it counts as alive.
export function buildRunningStatusFile(overrides: Partial<RunningStatusFile> = {}): RunningStatusFile {
  counter += 1;
  return {
    pid: process.pid,
    sessionId: `00000000-0000-4000-9000-${String(counter).padStart(12, "0")}`,
    cwd: "C:/code/outside",
    startedAt: Date.parse(EPOCH),
    entrypoint: "cli",
    hostSessionId: null,
    name: null,
    status: "busy",
    statusUpdatedAt: Date.parse(EPOCH),
    ...overrides,
  };
}

// The folder Claude Code names a session's transcripts after: every character but a letter or a digit becomes `-`.
export const transcriptFolderOf = (cwd: string) => cwd.replace(/[^A-Za-z0-9]/g, "-");

export const rootKeyOf = keyOf;
