import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { migrateDatabase, openDatabase, type Database } from "../src/db/client.js";
import type { LaunchInput, SessionLauncher } from "../src/features/launches/launches.launcher.js";
import type { QuestionRunner, RunInput, RunResult } from "../src/features/questions/questions.runner.js";
import type { ClaudeStatusFile } from "../src/features/sessions/sessions.desktop.js";
import type { ProjectFileInput, SessionFile } from "../src/features/sessions/sessions.export.js";
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
    project: (file: ProjectFileInput) => write("projects", `${rootKeyOf(file.root)}.json`, JSON.stringify(file)),
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
    return path;
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

// Claude Code's list of installed plugins: a file in another temporary folder, removed by reset().
function createPluginsFile() {
  const file = join(mkdtempSync(join(tmpdir(), "selo-ops-plugins-")), "installed_plugins.json");
  return { file, write: (content: string) => writeFileSync(file, content), clear: () => rmSync(file, { force: true }) };
}

// Claude Code's user settings file: a file in another temporary folder, never the person's, removed by reset().
function createSettingsFile() {
  const file = join(mkdtempSync(join(tmpdir(), "selo-ops-settings-")), "settings.json");
  return {
    file,
    write: (content: string) => writeFileSync(file, content),
    read: () => (existsSync(file) ? readFileSync(file, "utf8") : null),
    clear: () => rmSync(file, { force: true }),
  };
}

export interface FakeRun {
  input: RunInput;
  resolve(result: RunResult): void;
  reject(error: unknown): void;
}

// Never the real `claude`: each run waits until the test settles it; an abort rejects it, as the real runner does.
function createFakeRunner() {
  const runs: FakeRun[] = [];
  const pending = new Set<FakeRun>();
  const runner: QuestionRunner = {
    run: (input) =>
      new Promise<RunResult>((resolve, reject) => {
        const run: FakeRun = {
          input,
          resolve: (result) => {
            pending.delete(run);
            resolve(result);
          },
          reject: (error) => {
            pending.delete(run);
            reject(error);
          },
        };
        runs.push(run);
        pending.add(run);
        input.signal.addEventListener("abort", () => run.reject(new Error("aborted")));
      }),
  };
  // A run left working by a test ends before the next one, so that it never counts against the limit.
  const clear = async () => {
    for (const run of [...pending]) run.reject(new Error("test ended"));
    runs.length = 0;
    await new Promise((resolve) => setTimeout(resolve, 50));
  };
  return { runner, runs, clear };
}

// Never the real `claude`: each launch is recorded and answers what the test set, a success by default.
function createFakeLauncher() {
  const launches: LaunchInput[] = [];
  let outcome: () => Promise<{ id: string | null }> = () => Promise.resolve({ id: "bg-1234" });
  const launcher: SessionLauncher = {
    launch: (input) => {
      launches.push(input);
      return outcome();
    },
  };
  const answer = (next: () => Promise<{ id: string | null }>) => {
    outcome = next;
  };
  const clear = () => {
    launches.length = 0;
    outcome = () => Promise.resolve({ id: "bg-1234" });
  };
  return { launcher, launches, answer, clear };
}

export async function createTestContext({ questionTimeoutMs }: { questionTimeoutMs?: number } = {}) {
  const db: Database = openDatabase();
  await migrateDatabase(db);
  const clock = createTestClock();
  const ops = createOpsDir();
  const statuses = createStatusDir();
  const transcripts = createClaudeProjectsDir();
  const code = createCodeDir();
  const plugins = createPluginsFile();
  const settings = createSettingsFile();
  const questions = createFakeRunner();
  const launcher = createFakeLauncher();
  const app = createApp({
    db,
    clock,
    opsDir: ops.dir,
    claudeSessionsDir: statuses.dir,
    claudeProjectsDir: transcripts.dir,
    claudePluginsFile: plugins.file,
    claudeSettingsFile: settings.file,
    questionRunner: questions.runner,
    sessionLauncher: launcher.launcher,
    ...(questionTimeoutMs === undefined ? {} : { questionTimeoutMs }),
  });
  const seed = {
    ...ops.seed,
    status: statuses.status,
    rawStatus: statuses.raw,
    running: statuses.running,
    transcript: transcripts.transcript,
    plugins: plugins.write,
  };
  const reset = async () => {
    await questions.clear();
    launcher.clear();
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
    plugins.clear();
    settings.clear();
    clock.set(EPOCH);
  };
  return { app, db, clock, seed, code, settings, runs: questions.runs, launches: launcher.launches, answerLaunch: launcher.answer, reset, clearStatus: statuses.clear };
}
