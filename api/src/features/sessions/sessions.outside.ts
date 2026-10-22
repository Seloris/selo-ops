import { closeSync, existsSync, fstatSync, openSync, readdirSync, readFileSync, readSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import type { ExportRun } from "./sessions.export.js";

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
  model: string | null;
  // The uuid of the last person prompt: a new prompt is a new run (`session` BR-09).
  lastPromptId: string | null;
  modifiedAt: number;
}

export interface OutsideSession {
  status: RunningStatusFile;
  folder: string;
  state: ExportRun["phase"];
  git: GitPlace | null;
  transcript: Transcript | null;
}

export interface OutsideSessionReader {
  // `exported`: the session ids of every export file, which are never sessions outside selo.
  read(exported: Set<string>): OutsideSession[];
}

// As the selo plugin writes paths in the export (its slots.mjs normRoot): forward slashes, upper-case drive letter.
export const normRoot = (path: string) => resolve(path).replace(/\\/g, "/").replace(/^[a-z]:/, (d) => d.toUpperCase());
// As Claude Code names a transcript's folder after the session's folder.
const rootKey = (path: string) => normRoot(path).replace(/[^A-Za-z0-9]/g, "-");

const TAIL_BYTES = 256 * 1024;

// What Claude Code files as a wait on a permission dialog cannot be told from a tool that runs; a wait that declares no
// reason is one too. Any other wait is a question to the person.
const PERMISSION_WAITS = new Set(["permission prompt", "sandbox request", "worker request", "goal proposal"]);

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
  message: z.looseObject({
    content: z.union([z.string(), z.array(z.looseObject({ type: z.string(), text: z.string().optional() }))]),
  }),
});

// A person's prompt: a user line of the main thread with text, not a tool result nor a line Claude Code added.
function promptOf(value: unknown): { text: string; uuid: string | null } | null {
  const user = userSchema.safeParse(value);
  if (!user.success || user.data.isMeta === true || user.data.isSidechain === true) return null;
  const { content } = user.data.message;
  const text =
    typeof content === "string"
      ? content
      : content.some((block) => block.type === "tool_result")
        ? ""
        : content.flatMap((block) => (block.type === "text" && block.text !== undefined ? [block.text] : [])).join("\n");
  return text.trim() === "" ? null : { text, uuid: user.data.uuid ?? null };
}

export function readTranscript(path: string): Transcript {
  const { lines, modifiedAt } = readTail(path);
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
  return { request: lastPrompt ?? prompt?.text ?? null, model, lastPromptId: prompt?.uuid ?? null, modifiedAt };
}

const updatedAtOf = (status: RunningStatusFile) => status.updatedAt ?? status.statusUpdatedAt ?? status.startedAt;

export function createOutsideSessionReader(statusDir: string, projectsDir: string): OutsideSessionReader {
  return {
    read: (exported) => {
      // A crash leaves its file behind: only a live process counts. Two live files of one session (a resumed process):
      // the latest wins.
      const bySession = new Map<string, RunningStatusFile>();
      for (const status of readStatusFiles(statusDir)) {
        if (exported.has(status.sessionId) || !isPidAlive(status.pid)) continue;
        const other = bySession.get(status.sessionId);
        if (other === undefined || updatedAtOf(status) > updatedAtOf(other)) bySession.set(status.sessionId, status);
      }
      return [...bySession.values()].map((status) => {
        const path = findTranscript(projectsDir, status.cwd, status.sessionId);
        let transcript: Transcript | null = null;
        try {
          transcript = path === null ? null : readTranscript(path);
        } catch {
          // gone or locked between the lookup and the read: the session shows without it until the next read
        }
        return { status, folder: normRoot(status.cwd), state: stateOf(status), git: gitPlaceOf(status.cwd), transcript };
      });
    },
  };
}
