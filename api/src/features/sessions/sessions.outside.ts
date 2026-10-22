import { closeSync, existsSync, fstatSync, openSync, readdirSync, readFileSync, readSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import type { ExportRun } from "./sessions.export.js";
import { cleanRequest } from "./sessions.service.js";
import { createTranscriptStartReader, type TranscriptStartReader } from "./sessions.transcript.js";

// The sessions outside selo (`session` BR-12): a running Claude Code process whose session has no file in the ops export.
// Only what Claude Code itself writes is read: its status file of the process (`{config dir}/sessions/*.json`) and the
// session's transcript (`{config dir}/projects/{folder}/{sessionId}.jsonl`). Read only, nothing is copied to the database.

// Epoch milliseconds, within the range of a Date: a crafted value must not make a date invalid.
const epochMs = z.number().int().nonnegative().max(8.64e15);

const runningStatusSchema = z.looseObject({
  pid: z.number().int().positive(),
  sessionId: z.string().min(1),
  cwd: z.string().min(1),
  startedAt: epochMs,
  entrypoint: z.string().nullish(),
  hostSessionId: z.string().nullish(),
  name: z.string().nullish(),
  status: z.string().nullish(),
  waitingFor: z.string().nullish(),
  statusUpdatedAt: epochMs.nullish(),
  updatedAt: epochMs.nullish(),
});

export type RunningStatusFile = z.infer<typeof runningStatusSchema>;

export interface GitPlace {
  // The repository's git common dir in the export's `repo` form, so that a selo project of the same repository is joined.
  repo: string;
  // The branch of the folder's own checkout (a worktree's), null when detached.
  branch: string | null;
  // The branch of the repository's main checkout.
  mainBranch: string | null;
}

export interface Transcript {
  request: string | null;
  isRequestCut: boolean;
  model: string | null;
  // The last person prompt, by its uuid, else by its text when it left the tail: a new prompt is a new run (`session` BR-09).
  runKey: string | null;
  modifiedAt: number;
  // When its first dated line was written, null when its head holds no date.
  startedAt: number | null;
}

// A wait on a permission dialog held long enough to be the person's (`session` BR-16).
export interface PermissionWait {
  // The shell command to allow, else the tool's name; null when the transcript names none.
  tool: string | null;
}

export interface OutsideSession {
  status: RunningStatusFile;
  folder: string;
  state: ExportRun["phase"];
  permissionWait: PermissionWait | null;
  git: GitPlace | null;
  transcript: Transcript | null;
}

// An open session of the export, whose running process may wait on a permission dialog.
export interface OpenExportSession {
  sessionId: string;
  root: string;
  // The folder Claude Code names its transcripts after, as the export gives it.
  rootKey: string;
}

export interface ClaudeSessionsRead {
  outside: OutsideSession[];
  // By session id: the open sessions of the export that wait on a permission.
  permissionWaits: Map<string, PermissionWait>;
}

export interface OutsideSessionReader {
  // `exported`: the session ids of every export file, which are never sessions outside selo. `open`: the export's open
  // sessions, checked for a permission wait. `now`: epoch milliseconds, from the service's clock.
  read(query: { exported: Set<string>; open?: OpenExportSession[]; now: number }): ClaudeSessionsRead;
}

// As the selo plugin writes paths in the export (its slots.mjs normRoot): forward slashes, upper-case drive letter.
export const normRoot = (path: string) => resolve(path).replace(/\\/g, "/").replace(/^[a-z]:/, (d) => d.toUpperCase());
// As Claude Code names a transcript's folder after the session's folder.
const rootKey = (path: string) => normRoot(path).replace(/[^A-Za-z0-9]/g, "-");

const TAIL_BYTES = 256 * 1024;

// What Claude Code files as a wait on a dialog cannot be told from a tool that runs; a wait that declares no reason is one
// too. Any other wait is a question to the person.
const PERMISSION_WAITS = new Set(["permission prompt", "sandbox request", "worker request", "goal proposal"]);
// The dialogs the person must allow (`session` BR-16); a worker request or a goal proposal asks nobody.
const PERMISSION_DIALOGS = new Set(["permission prompt", "sandbox request"]);
// Auto mode's own checks open the dialog for a moment: only a longer wait is the person's.
const PERMISSION_HOLD_MS = 15_000;

// `session` BR-13. A status Claude Code may add later says nothing about a wait: the process lives, so it works.
export function stateOf(status: RunningStatusFile): ExportRun["phase"] {
  if (status.status === "idle") return "turn-ended";
  if (status.status === "waiting") {
    const reason = status.waitingFor ?? null;
    return reason === null || PERMISSION_WAITS.has(reason) ? "working" : "awaiting-answer";
  }
  return "working";
}

// Signal 0 only tests that the process exists. EPERM: it exists, owned by someone else.
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "EPERM";
  }
}

const readText = (path: string): string | null => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

const branchOf = (gitDir: string) => /^ref:\s*refs\/heads\/(.+)$/m.exec(readText(join(gitDir, "HEAD")) ?? "")?.[1]?.trim() ?? null;

// The nearest `.git` above the folder, read from the files themselves: no git process on the page's 5 s poll. A worktree's
// `.git` is a file naming its own git dir, whose `commondir` leads to the repository's.
export function gitPlaceOf(folder: string): GitPlace | null {
  let current = resolve(folder);
  for (;;) {
    const dotGit = join(current, ".git");
    if (existsSync(dotGit)) {
      let gitDir = dotGit;
      try {
        if (statSync(dotGit).isFile()) {
          const target = /^gitdir:\s*(.+)$/m.exec(readText(dotGit) ?? "")?.[1]?.trim();
          if (target === undefined) return null;
          gitDir = resolve(current, target);
        }
      } catch {
        return null;
      }
      const common = readText(join(gitDir, "commondir"))?.trim();
      const commonDir = common ? resolve(gitDir, common) : gitDir;
      return { repo: normRoot(commonDir), branch: branchOf(gitDir), mainBranch: branchOf(commonDir) };
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function readStatusFiles(statusDir: string): RunningStatusFile[] {
  let names: string[];
  try {
    // `*.json` only: the folder also holds `{pid}.{hash}.key` files, never opened.
    names = readdirSync(statusDir).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    try {
      const parsed = runningStatusSchema.safeParse(JSON.parse(readFileSync(join(statusDir, name), "utf8")));
      return parsed.success ? [parsed.data] : [];
    } catch {
      // unreadable or half-written: skipped until the next read
      return [];
    }
  });
}

// The transcript's folder is named after the session's folder, but its case varies (`c--` and `C--` both exist).
function findTranscript(projectsDir: string, folder: string, sessionId: string): string | null {
  let folders: string[];
  try {
    folders = readdirSync(projectsDir);
  } catch {
    return null;
  }
  const key = rootKey(folder).toLowerCase();
  const file = `${sessionId}.jsonl`;
  const ordered = [...folders.filter((f) => f.toLowerCase() === key), ...folders.filter((f) => f.toLowerCase() !== key)];
  for (const name of ordered) {
    const path = join(projectsDir, name, file);
    if (existsSync(path)) return path;
  }
  return null;
}

// The last bytes only: a transcript grows to megabytes; the first line of the tail may be cut, it then fails to parse.
function readTail(path: string): { lines: string[]; modifiedAt: number } {
  const fd = openSync(path, "r");
  try {
    const { size, mtimeMs } = fstatSync(fd);
    const length = Math.min(size, TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    return { lines: buffer.toString("utf8").split("\n"), modifiedAt: mtimeMs };
  } finally {
    closeSync(fd);
  }
}

const lastPromptSchema = z.looseObject({ type: z.literal("last-prompt"), lastPrompt: z.string() });
const assistantSchema = z.looseObject({ type: z.literal("assistant"), message: z.looseObject({ model: z.string() }) });
const userSchema = z.looseObject({
  type: z.literal("user"),
  uuid: z.string().optional(),
  isMeta: z.boolean().optional(),
  isSidechain: z.boolean().optional(),
  isCompactSummary: z.boolean().optional(),
  isVisibleInTranscriptOnly: z.boolean().optional(),
  message: z.looseObject({
    content: z.union([z.string(), z.array(z.looseObject({ type: z.string(), text: z.string().optional() }))]),
  }),
});

// A person's prompt: a user line of the main thread with text, not a tool result nor a line Claude Code added (a meta
// line, a compact summary, a command's output or a task notification, which are nothing but wrapper tags).
function promptOf(value: unknown): { text: string; uuid: string | null } | null {
  const user = userSchema.safeParse(value);
  if (!user.success) return null;
  const { isMeta, isSidechain, isCompactSummary, isVisibleInTranscriptOnly } = user.data;
  if (isMeta === true || isSidechain === true || isCompactSummary === true || isVisibleInTranscriptOnly === true) return null;
  const { content } = user.data.message;
  const text =
    typeof content === "string"
      ? content
      : content.some((block) => block.type === "tool_result")
        ? ""
        : content.flatMap((block) => (block.type === "text" && block.text !== undefined ? [block.text] : [])).join("\n");
  return cleanRequest(text).text === "" ? null : { text, uuid: user.data.uuid ?? null };
}

export function readTranscript(path: string, transcriptStartOf: TranscriptStartReader): Transcript {
  const { lines, modifiedAt } = readTail(path);
  const startedAt = transcriptStartOf(path);
  let lastPrompt: string | null = null;
  let prompt: { text: string; uuid: string | null } | null = null;
  let model: string | null = null;
  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    const last = lastPromptSchema.safeParse(value);
    if (last.success) {
      lastPrompt = last.data.lastPrompt;
      continue;
    }
    const assistant = assistantSchema.safeParse(value);
    // `<synthetic>`: a message Claude Code wrote itself, no model answered it.
    if (assistant.success && assistant.data.message.model !== "<synthetic>") {
      model = assistant.data.message.model;
      continue;
    }
    prompt = promptOf(value) ?? prompt;
  }
  // The prompt in the tail is whole; Claude Code cuts `lastPrompt` at 200 characters and an ellipsis.
  if (prompt !== null) {
    return { request: prompt.text, isRequestCut: false, model, runKey: prompt.uuid ?? `prompt:${prompt.text}`, modifiedAt, startedAt };
  }
  if (lastPrompt !== null) {
    const isCut = lastPrompt.endsWith("…");
    // A turn longer than the tail pushed its prompt out: its text still tells this run from the next one.
    const request = isCut ? lastPrompt.slice(0, -1) : lastPrompt;
    return { request, isRequestCut: isCut, model, runKey: `prompt:${lastPrompt}`, modifiedAt, startedAt };
  }
  return { request: null, isRequestCut: false, model, runKey: null, modifiedAt, startedAt };
}

const updatedAtOf = (status: RunningStatusFile) => status.updatedAt ?? status.statusUpdatedAt ?? status.startedAt;

// `session` BR-16: `statusUpdatedAt` is when the process started to wait; with none, its last update.
export function isPermissionWait(status: RunningStatusFile, now: number): boolean {
  if (status.status !== "waiting" || !PERMISSION_DIALOGS.has(status.waitingFor ?? "")) return false;
  return now - (status.statusUpdatedAt ?? updatedAtOf(status)) >= PERMISSION_HOLD_MS;
}

const SHELL_TOOLS = new Set(["Bash", "mcp__terminal__run_in_terminal"]);
// A subagent's own call is in its own transcript, not in the main one: the tool it waits on is unknown.
const SUBAGENT_TOOLS = new Set(["Agent", "Task"]);

const blocksSchema = z.array(z.looseObject({ type: z.string(), tool_use_id: z.string().optional() }));
const toolLineSchema = z.looseObject({
  type: z.enum(["assistant", "user"]),
  isSidechain: z.boolean().optional(),
  message: z.looseObject({ content: z.unknown() }),
});
const toolUseSchema = z.looseObject({ id: z.string(), name: z.string(), input: z.looseObject({ command: z.unknown().optional() }).optional() });

// The tool the dialog asks for: the main thread's last call with no result after it.
export function permissionToolOf(path: string): string | null {
  const { lines } = readTail(path);
  const open = new Map<string, z.infer<typeof toolUseSchema>>();
  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    const parsed = toolLineSchema.safeParse(value);
    if (!parsed.success || parsed.data.isSidechain === true) continue;
    const blocks = blocksSchema.safeParse(parsed.data.message.content);
    if (!blocks.success) continue;
    for (const block of blocks.data) {
      if (block.type === "tool_result" && block.tool_use_id !== undefined) open.delete(block.tool_use_id);
      if (block.type !== "tool_use") continue;
      const use = toolUseSchema.safeParse(block);
      if (use.success) open.set(use.data.id, use.data);
    }
  }
  const last = [...open.values()].pop();
  if (last === undefined || SUBAGENT_TOOLS.has(last.name)) return null;
  const command = last.input?.command;
  return SHELL_TOOLS.has(last.name) && typeof command === "string" && command.trim() !== "" ? command : last.name;
}

function permissionWaitOf(status: RunningStatusFile, now: number, transcriptPath: () => string | null): PermissionWait | null {
  if (!isPermissionWait(status, now)) return null;
  try {
    const path = transcriptPath();
    return { tool: path === null ? null : permissionToolOf(path) };
  } catch {
    // gone or locked between the lookup and the read: the wait shows without its tool until the next read
    return { tool: null };
  }
}

// An export session's transcript sits in the folder the export names, else in another case of it (`findTranscript`).
function exportTranscriptOf(projectsDir: string, session: OpenExportSession): string | null {
  const own = join(projectsDir, session.rootKey, `${session.sessionId}.jsonl`);
  return existsSync(own) ? own : findTranscript(projectsDir, session.root, session.sessionId);
}

export function createOutsideSessionReader(statusDir: string, projectsDir: string): OutsideSessionReader {
  const transcriptStartOf = createTranscriptStartReader();
  return {
    read: ({ exported, open = [], now }) => {
      // A crash leaves its file behind: only a live process counts. Two live files of one session (a resumed process):
      // the latest wins.
      // A closed session of the export is never checked: its process is not even tested.
      const openIds = new Set(open.map((session) => session.sessionId));
      const bySession = new Map<string, RunningStatusFile>();
      for (const status of readStatusFiles(statusDir)) {
        if ((exported.has(status.sessionId) && !openIds.has(status.sessionId)) || !isPidAlive(status.pid)) continue;
        const other = bySession.get(status.sessionId);
        if (other === undefined || updatedAtOf(status) > updatedAtOf(other)) bySession.set(status.sessionId, status);
      }
      const outside = [...bySession.values()]
        .filter((status) => !exported.has(status.sessionId))
        .map((status) => {
          const path = findTranscript(projectsDir, status.cwd, status.sessionId);
          let transcript: Transcript | null = null;
          try {
            transcript = path === null ? null : readTranscript(path, transcriptStartOf);
          } catch {
            // gone or locked between the lookup and the read: the session shows without it until the next read
          }
          const permissionWait = permissionWaitOf(status, now, () => path);
          return { status, folder: normRoot(status.cwd), state: stateOf(status), permissionWait, git: gitPlaceOf(status.cwd), transcript };
        });
      // `session` BR-16: the export's open sessions, by the same status files; a closed one is never asked for.
      const permissionWaits = new Map<string, PermissionWait>();
      for (const session of open) {
        const status = bySession.get(session.sessionId);
        const wait = status === undefined ? null : permissionWaitOf(status, now, () => exportTranscriptOf(projectsDir, session));
        if (wait !== null) permissionWaits.set(session.sessionId, wait);
      }
      return { outside, permissionWaits };
    },
  };
}
