import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { migrateDatabase, openDatabase, type Database } from "../src/db/client.js";
import type { ClaudeStatusFile } from "../src/features/sessions/sessions.desktop.js";
import type { ProjectFile, SessionFile } from "../src/features/sessions/sessions.export.js";
import type { RunningStatusFile } from "../src/features/sessions/sessions.outside.js";
import type { Clock } from "../src/shared/clock.js";
import { rootKeyOf } from "./factories.js";

const EPOCH = "2026-01-01T00:00:00.000Z";

export interface TestClock extends Clock {
  set(iso: string): void;
}

export function createTestClock(): TestClock {
  let current = new Date(EPOCH);
  return {
    now: () => current,
    set: (iso) => {
      current = new Date(iso);
    },
  };
}

// The ops export the API reads: a temporary folder per test file, emptied by reset().
function createOpsDir() {
  const dir = mkdtempSync(join(tmpdir(), "selo-ops-test-"));
  const write = (sub: string, name: string, content: string) => {
    mkdirSync(join(dir, sub), { recursive: true });
    writeFileSync(join(dir, sub, name), content);
  };
  const seed = {
    session: (file: SessionFile) => write("sessions", `${file.sessionId}.json`, JSON.stringify(file)),
    project: (file: ProjectFile) => write("projects", `${rootKeyOf(file.root)}.json`, JSON.stringify(file)),
    raw: (sub: "sessions" | "projects", name: string, content: string) => write(sub, name, content),
  };
  const clear = () => {
    rmSync(join(dir, "sessions"), { recursive: true, force: true });
    rmSync(join(dir, "projects"), { recursive: true, force: true });
  };
  return { dir, seed, clear };
}

// Claude Code's status files of running processes: another temporary folder, emptied by reset().
function createStatusDir() {
  const dir = mkdtempSync(join(tmpdir(), "selo-ops-status-"));
  const raw = (name: string, content: string) => writeFileSync(join(dir, name), content);
  const clear = () => {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir);
  };
  return {
    dir,
    raw,
    status: (file: ClaudeStatusFile) => raw(`${file.sessionId}.json`, JSON.stringify(file)),
    running: (file: RunningStatusFile) => raw(`${file.pid}-${file.sessionId}.json`, JSON.stringify(file)),
    clear,
  };
}

// Claude Code's transcripts, one folder per session folder, and the folders the sessions run in: other temporary folders.
function createClaudeProjectsDir() {
  const dir = mkdtempSync(join(tmpdir(), "selo-ops-projects-"));
  const transcript = (folderName: string, sessionId: string, lines: unknown[], modifiedAt?: string) => {
    mkdirSync(join(dir, folderName), { recursive: true });
    const path = join(dir, folderName, `${sessionId}.jsonl`);
    writeFileSync(path, lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n") + "\n");
    if (modifiedAt) utimesSync(path, new Date(modifiedAt), new Date(modifiedAt));
  };
  const clear = () => {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir);
  };
  return { dir, transcript, clear };
}

// Folders a session outside selo runs in: a repository (a `.git` folder), a worktree (a `.git` file), or no repository.
function createCodeDir() {
  const dir = mkdtempSync(join(tmpdir(), "selo-ops-code-"));
  const folder = (name: string) => {
    const path = join(dir, name);
    mkdirSync(path, { recursive: true });
    return path;
  };
  const repo = (name: string, branch = "main") => {
    const path = folder(name);
    mkdirSync(join(path, ".git"), { recursive: true });
    writeFileSync(join(path, ".git", "HEAD"), `ref: refs/heads/${branch}\n`);
    return path;
  };
  const worktree = (repoPath: string, name: string, branch: string) => {
    const path = folder(name);
    const gitDir = join(repoPath, ".git", "worktrees", name);
    mkdirSync(gitDir, { recursive: true });
    writeFileSync(join(gitDir, "HEAD"), `ref: refs/heads/${branch}\n`);
    writeFileSync(join(gitDir, "commondir"), "../..\n");
    writeFileSync(join(path, ".git"), `gitdir: ${gitDir}\n`);
    return path;
  };
  const clear = () => {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir);
  };
  return { dir, folder, repo, worktree, clear };
}

export async function createTestContext() {
  const db: Database = openDatabase();
  await migrateDatabase(db);
  const clock = createTestClock();
  const ops = createOpsDir();
  const statuses = createStatusDir();
  const transcripts = createClaudeProjectsDir();
  const code = createCodeDir();
  const app = createApp({ db, clock, opsDir: ops.dir, claudeSessionsDir: statuses.dir, claudeProjectsDir: transcripts.dir });
  const seed = { ...ops.seed, status: statuses.status, rawStatus: statuses.raw, running: statuses.running, transcript: transcripts.transcript };
  const reset = async () => {
    const tables = await db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name <> '__drizzle_migrations'
    `);
    for (const { table_name } of tables.rows) {
      await db.execute(sql.raw(`truncate table "${table_name}" cascade`));
    }
    ops.clear();
    statuses.clear();
    transcripts.clear();
    code.clear();
    clock.set(EPOCH);
  };
  return { app, db, clock, seed, code, reset, clearStatus: statuses.clear };
}
