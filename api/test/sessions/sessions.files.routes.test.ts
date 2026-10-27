import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fileSummarySchema } from "../../src/features/sessions/sessions.schema.js";
import type { ProblemDetails } from "../../src/shared/errors.js";
import { buildRun, buildSessionFile } from "../factories.js";
import { createTestContext } from "../setup.js";

// A real repository: the summary route runs git in the session's folder.
function createRepository(root: string) {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  git("config", "core.autocrlf", "false");
  const write = (file: string, content: string | Buffer) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  };
  const commit = (subject: string, files: Record<string, string | Buffer | null>) => {
    for (const [file, content] of Object.entries(files)) {
      if (content === null) rmSync(join(root, file));
      else write(file, content);
    }
    git("add", "-A", "--", ...Object.keys(files));
    git("commit", "-q", "-m", subject);
    return git("rev-parse", "--short", "HEAD");
  };
  return { write, commit, remove: (file: string) => rmSync(join(root, file)) };
}

describe("session file summary routes", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const getFiles = (id: string) => request(ctx.app).get(`/v1/sessions/${id}/files`);

  it("sums each touched file's lines over its recorded commits and its uncommitted part", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.commit("chore: start", { "src/balance.ts": "a\nb\nc\n" });
    const first = repo.commit("feat: balance", { "src/balance.ts": "a\nB\nc\nd\n" });
    const other = repo.commit("docs: readme", { "README.md": "# Ledger\n" });
    repo.write("src/balance.ts", "a\nB\nc\nd\ne\n");
    const current = buildRun({ commits: [{ sha: first, subject: "feat: balance" }, { sha: other, subject: "docs: readme" }] });
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/balance.ts", "README.md"], current }));

    // Act
    const res = await getFiles("s1");

    // Assert
    expect(res.status).toBe(200);
    expect(fileSummarySchema.parse(res.body)).toEqual({
      isAvailable: true,
      files: [
        { file: "src/balance.ts", status: "modified", added: 3, removed: 1, isUncommitted: true },
        { file: "README.md", status: "added", added: 1, removed: 0, isUncommitted: false },
      ],
    });
  });

  it("marks a file git does not track yet as added and uncommitted, counted in full", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.commit("chore: start", { "README.md": "# Ledger\n" });
    repo.write("src/new.ts", "one\ntwo\n");
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/new.ts"] }));

    // Act
    const res = await getFiles("s1");

    // Assert
    expect(fileSummarySchema.parse(res.body).files).toEqual([{ file: "src/new.ts", status: "added", added: 2, removed: 0, isUncommitted: true }]);
  });

  it("marks a file removed by the session as deleted", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.commit("chore: start", { "old.ts": "x\ny\n", "gone.ts": "z\n" });
    const sha = repo.commit("refactor: drop old", { "old.ts": null });
    repo.remove("gone.ts");
    const current = buildRun({ commits: [{ sha, subject: "refactor: drop old" }] });
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["old.ts", "gone.ts"], current }));

    // Act
    const res = await getFiles("s1");

    // Assert
    expect(fileSummarySchema.parse(res.body).files).toEqual([
      { file: "old.ts", status: "deleted", added: 0, removed: 2, isUncommitted: false },
      { file: "gone.ts", status: "deleted", added: 0, removed: 1, isUncommitted: true },
    ]);
  });

  it("gives no status and no lines to a file with no change found", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.commit("chore: start", { "src/balance.ts": "a\n" });
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/balance.ts"] }));

    // Act
    const res = await getFiles("s1");

    // Assert
    expect(fileSummarySchema.parse(res.body).files).toEqual([{ file: "src/balance.ts", status: null, added: 0, removed: 0, isUncommitted: false }]);
  });

  it("gives no line counts to a binary file", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.commit("chore: start", { "README.md": "# Ledger\n" });
    const sha = repo.commit("feat: logo", { "logo.png": Buffer.from([0, 1, 2, 0, 255, 0]) });
    const current = buildRun({ commits: [{ sha, subject: "feat: logo" }] });
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["logo.png"], current }));

    // Act
    const res = await getFiles("s1");

    // Assert
    expect(fileSummarySchema.parse(res.body).files).toEqual([{ file: "logo.png", status: "added", added: null, removed: null, isUncommitted: false }]);
  });

  it("gives no line counts to an untracked binary file", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.commit("chore: start", { "README.md": "# Ledger\n" });
    repo.write("logo.png", Buffer.from([0, 1, 2, 0, 255, 0]));
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["logo.png"] }));

    // Act
    const res = await getFiles("s1");

    // Assert
    expect(fileSummarySchema.parse(res.body).files).toEqual([{ file: "logo.png", status: "added", added: null, removed: null, isUncommitted: true }]);
  });

  it("skips a commit git no longer has", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.commit("chore: start", { "src/balance.ts": "a\n" });
    repo.write("src/balance.ts", "b\n");
    const current = buildRun({ commits: [{ sha: "abcdef1", subject: "feat: landed then removed" }, { sha: "--output=pwned", subject: "odd" }] });
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/balance.ts"], current }));

    // Act
    const res = await getFiles("s1");

    // Assert
    expect(fileSummarySchema.parse(res.body).files).toEqual([{ file: "src/balance.ts", status: "modified", added: 1, removed: 1, isUncommitted: true }]);
  });

  it("reads a repository with no commit yet, every touched file untracked", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.write("a.ts", "x\n");
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["a.ts"] }));

    // Act
    const res = await getFiles("s1");

    // Assert
    expect(fileSummarySchema.parse(res.body).files).toEqual([{ file: "a.ts", status: "added", added: 1, removed: 0, isUncommitted: true }]);
  });

  it("says the summary is unavailable when the session's folder is gone", async () => {
    // Arrange
    const root = join(ctx.code.dir, "removed-worktree");
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/balance.ts"] }));

    // Act
    const res = await getFiles("s1");

    // Assert
    expect(res.status).toBe(200);
    expect(fileSummarySchema.parse(res.body)).toEqual({ isAvailable: false, files: [] });
  });

  it("returns 502 when git cannot run", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    createRepository(root);
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/balance.ts"] }));
    const path = process.env.PATH;
    process.env.PATH = "";

    // Act
    let res: Awaited<ReturnType<typeof getFiles>>;
    try {
      res = await getFiles("s1");
    } finally {
      process.env.PATH = path;
    }

    // Assert
    expect(res.status).toBe(502);
    expect((res.body as ProblemDetails).code).toBe("git_failed");
  });

  it("returns 404 for a session the export does not hold", async () => {
    // Act
    const res = await getFiles("missing");

    // Assert
    expect(res.status).toBe(404);
  });
});
