import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { AppError } from "../../shared/errors.js";

// `session` BR-01: git runs read-only in a session's folder, when the person asks for its files, never on the 5 s poll.

const TIMEOUT_MS = 5000;
// What git may print before it is stopped; the diff the response carries is cut shorter.
const MAX_BUFFER = 1024 * 1024;
export const DIFF_MAX = 200_000;

// git did not answer (timed out, missing, killed): never mistaken for a commit gone or a file with no change.
export class GitFailedError extends AppError {
  constructor() {
    super(502, "git_failed", "git could not read the diff");
  }
}

// git's exit code for a revision it does not have.
const UNKNOWN_REVISION = 128;

export interface DiffText {
  diff: string;
  isCut: boolean;
}

// What one commit, or the uncommitted changes, did to one file: its status letter and its lines, null for a binary file.
export interface FileStat {
  file: string;
  status: "A" | "M" | "D";
  added: number | null;
  removed: number | null;
}

export interface GitDiffReader {
  // False when the folder is gone or is no git checkout.
  isCheckout(root: string): Promise<boolean>;
  // "" when the commit does not change the file; null when git does not have the commit.
  commitDiff(root: string, sha: string, file: string): Promise<DiffText | null>;
  // The file against HEAD, an untracked file in full; null when it has no uncommitted change.
  uncommittedDiff(root: string, file: string): Promise<DiffText | null>;
  // The files of `files` the commit changes; null when git does not have the commit.
  commitStats(root: string, sha: string, files: readonly string[]): Promise<FileStat[] | null>;
  // The files of `files` changed against HEAD, then those git does not track yet, counted in full.
  uncommittedStats(root: string, files: readonly string[]): Promise<FileStat[]>;
}

interface GitResult {
  code: number | null;
  stdout: string;
  isCut: boolean;
}

// No shell: arguments go to git as they are. Paths are literal (a `[slug]` folder is no glob). No pager, colour,
// external diff, textconv driver nor fsmonitor hook; no optional lock, so a read never writes the shared checkout's index.
function git(cwd: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-c", "core.quotepath=off", "-c", "core.fsmonitor=false", "--no-pager", "--literal-pathspecs", ...args],
      { cwd, timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, windowsHide: true, encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } },
      (error, stdout) => {
        if (!error) return resolve({ code: 0, stdout, isCut: false });
        const code = (error as { code?: unknown }).code;
        if (code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") return resolve({ code: 0, stdout, isCut: true });
        resolve({ code: typeof code === "number" ? code : null, stdout, isCut: false });
      },
    );
  });
}

const failed = (res: GitResult) => res.code === null;

const DIFF_FLAGS = ["--no-color", "--no-ext-diff", "--no-textconv"];

// `--raw` lines (`:100644 100644 abc def M<tab>path`) give each file's status, `--numstat` lines (`3<tab>1<tab>path`, `-` for a
// binary file) its lines. Renames are off: a moved file reads as one deleted and one added.
const STAT_FLAGS = ["--raw", "--numstat", "--no-renames", "--relative", ...DIFF_FLAGS];

function parseStats(stdout: string): FileStat[] {
  const statuses = new Map<string, FileStat["status"]>();
  const stats: FileStat[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    if (line.startsWith(":")) {
      const letter = line.slice(0, tab).trim().split(/\s+/).pop() ?? "";
      statuses.set(line.slice(tab + 1), letter === "A" ? "A" : letter === "D" ? "D" : "M");
      continue;
    }
    const match = /^(\d+|-)\t(\d+|-)\t(.*)$/.exec(line);
    if (!match) continue;
    const [, added = "-", removed = "-", file = ""] = match;
    stats.push({ file, status: "M", added: added === "-" ? null : Number(added), removed: removed === "-" ? null : Number(removed) });
  }
  return stats.map((s) => ({ ...s, status: statuses.get(s.file) ?? "M" }));
}

// The touched files as pathspec, so a large commit or a busy shared checkout prints only them; past what a command
// line holds on Windows, none, the output then filtered by name.
const PATHSPEC_MAX = 16_000;
const pathspec = (files: readonly string[]) => (files.length > 0 && files.join(" ").length <= PATHSPEC_MAX ? ["--", ...files] : []);

// A cut output ends on a partial line: it is never read.
const wholeLines = ({ stdout, isCut }: GitResult) => (isCut ? stdout.slice(0, stdout.lastIndexOf("\n") + 1) : stdout);

const toText = ({ stdout, isCut }: GitResult): DiffText =>
  stdout.length > DIFF_MAX || isCut ? { diff: stdout.slice(0, DIFF_MAX), isCut: true } : { diff: stdout, isCut: false };

export function createGitDiffReader(): GitDiffReader {
  return {
    async isCheckout(root) {
      if (!existsSync(root)) return false;
      const res = await git(root, ["rev-parse", "--is-inside-work-tree"]);
      if (failed(res)) throw new GitFailedError();
      return res.code === 0 && res.stdout.trim() === "true";
    },

    async commitDiff(root, sha, file) {
      const res = await git(root, ["show", "--format=", ...DIFF_FLAGS, sha, "--", file]);
      if (res.code === 0) return toText(res);
      if (res.code === UNKNOWN_REVISION) return null;
      throw new GitFailedError();
    },

    async uncommittedDiff(root, file) {
      // A repository with no commit yet has no HEAD (exit 128): every file of it is untracked.
      const tracked = await git(root, ["diff", ...DIFF_FLAGS, "HEAD", "--", file]);
      if (tracked.code === 0 && tracked.stdout !== "") return toText(tracked);
      if (tracked.code !== 0 && tracked.code !== UNKNOWN_REVISION) throw new GitFailedError();
      const untracked = await git(root, ["ls-files", "--others", "--exclude-standard", "--", file]);
      if (untracked.code !== 0) throw new GitFailedError();
      if (untracked.stdout.trim() === "") return null;
      // `--no-index` exits with 1 when the files differ; `--literal-pathspecs` does not apply to its two paths.
      const added = await git(root, ["diff", "--no-index", ...DIFF_FLAGS, "--", "/dev/null", file]);
      if (added.code !== 0 && added.code !== 1) throw new GitFailedError();
      return added.stdout === "" ? null : toText(added);
    },

    async commitStats(root, sha, files) {
      const res = await git(root, ["show", "--format=", ...STAT_FLAGS, sha, ...pathspec(files)]);
      if (res.code === 0) return parseStats(wholeLines(res));
      if (res.code === UNKNOWN_REVISION) return null;
      throw new GitFailedError();
    },

    async uncommittedStats(root, files) {
      const tracked = await git(root, ["diff", ...STAT_FLAGS, "HEAD", ...pathspec(files)]);
      if (tracked.code !== 0 && tracked.code !== UNKNOWN_REVISION) throw new GitFailedError();
      const stats = tracked.code === 0 ? parseStats(wholeLines(tracked)) : [];
      const listed = await git(root, ["ls-files", "--others", "--exclude-standard", ...pathspec(files)]);
      if (listed.code !== 0) throw new GitFailedError();
      const wanted = new Set(files);
      const untracked = wholeLines(listed).split(/\r?\n/).filter((file) => file !== "" && wanted.has(file));
      for (const file of untracked) {
        const added = await git(root, ["diff", "--no-index", "--numstat", ...DIFF_FLAGS, "--", "/dev/null", file]);
        if (added.code !== 0 && added.code !== 1) throw new GitFailedError();
        const [stat] = parseStats(added.stdout);
        stats.push({ file, status: "A", added: stat ? stat.added : 0, removed: stat ? stat.removed : 0 });
      }
      return stats;
    },
  };
}
