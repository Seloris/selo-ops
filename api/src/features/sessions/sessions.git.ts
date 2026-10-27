import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { AppError } from "../../shared/errors.js";

// `session` BR-01: git runs read-only in a session's folder, on a click for one file, never on the 5 s poll.

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

export interface GitDiffReader {
  // False when the folder is gone or is no git checkout.
  isCheckout(root: string): Promise<boolean>;
  // "" when the commit does not change the file; null when git does not have the commit.
  commitDiff(root: string, sha: string, file: string): Promise<DiffText | null>;
  // The file against HEAD, an untracked file in full; null when it has no uncommitted change.
  uncommittedDiff(root: string, file: string): Promise<DiffText | null>;
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
  };
}
