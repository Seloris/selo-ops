import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fileDiffSchema } from "../../src/features/sessions/sessions.schema.js";
import type { ProblemDetails } from "../../src/shared/errors.js";
import { buildRun, buildSessionFile } from "../factories.js";
import { createTestContext } from "../setup.js";

// A real repository: the diff route runs git in the session's folder.
function createRepository(root: string) {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  git("config", "core.autocrlf", "false");
  const write = (file: string, content: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  };
  const commit = (subject: string, files: Record<string, string>) => {
    for (const [file, content] of Object.entries(files)) write(file, content);
    git("add", "--", ...Object.keys(files));
    git("commit", "-q", "-m", subject);
    return git("rev-parse", "--short", "HEAD");
  };
  return { write, commit };
}

describe("session file diff routes", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const getDiff = (id: string, file?: string) => request(ctx.app).get(`/v1/sessions/${id}/diff`).query(file === undefined ? {} : { file });

  it("gives the diff of each recorded commit that changes the file, oldest first", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    const first = repo.commit("feat: balance", { "src/balance.ts": "export const a = 1;\n" });
    const other = repo.commit("docs: readme", { "README.md": "# Ledger\n" });
    const second = repo.commit("fix: balance", { "src/balance.ts": "export const a = 2;\n" });
    const earlier = buildRun({ since: "2026-01-01T08:00:00.000Z", commits: [{ sha: first, subject: "feat: balance" }] });
    const current = buildRun({
      since: "2026-01-01T09:00:00.000Z",
      commits: [
        { sha: other, subject: "docs: readme" },
        { sha: second, subject: "fix: balance" },
      ],
    });
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/balance.ts", "README.md"], current, runs: [current, earlier] }));

    // Act
    const res = await getDiff("s1", "src/balance.ts");

    // Assert
    expect(res.status).toBe(200);
    const diff = fileDiffSchema.parse(res.body);
    expect(diff.file).toBe("src/balance.ts");
    expect(diff.isAvailable).toBe(true);
    expect(diff.commits.map((c) => c.sha)).toEqual([first, second]);
    expect(diff.commits[0].diff).toContain("+export const a = 1;");
    expect(diff.commits[1].subject).toBe("fix: balance");
    expect(diff.commits[1].diff).toContain("-export const a = 1;");
    expect(diff.commits[1].diff).toContain("+export const a = 2;");
    expect(diff.uncommitted).toBeNull();
  });

  it("gives the file's uncommitted part against HEAD", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.commit("feat: balance", { "src/balance.ts": "export const a = 1;\n" });
    repo.write("src/balance.ts", "export const a = 3;\n");
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/balance.ts"] }));

    // Act
    const res = await getDiff("s1", "src/balance.ts");

    // Assert
    const diff = fileDiffSchema.parse(res.body);
    expect(diff.commits).toEqual([]);
    expect(diff.uncommitted?.diff).toContain("+export const a = 3;");
    expect(diff.uncommitted?.isCut).toBe(false);
  });

  it("gives a new file git does not track yet in full", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.commit("chore: start", { "README.md": "# Ledger\n" });
    repo.write("src/new.ts", "export const fresh = true;\n");
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/new.ts"] }));

    // Act
    const res = await getDiff("s1", "src/new.ts");

    // Assert
    const diff = fileDiffSchema.parse(res.body);
    expect(diff.uncommitted?.diff).toContain("+export const fresh = true;");
  });

  it("reads a path with brackets literally, never as a glob matching another file", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    const sha = repo.commit("feat: pages", { "app/[slug]/page.tsx": "export const page = 1;\n", "app/s/page.tsx": "export const other = 1;\n" });
    repo.write("app/[slug]/page.tsx", "export const page = 2;\n");
    repo.write("app/s/page.tsx", "export const other = 2;\n");
    const current = buildRun({ commits: [{ sha, subject: "feat: pages" }] });
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["app/[slug]/page.tsx"], current }));

    // Act
    const res = await getDiff("s1", "app/[slug]/page.tsx");

    // Assert
    const diff = fileDiffSchema.parse(res.body);
    expect(diff.commits[0]?.diff).toContain("+export const page = 1;");
    expect(diff.commits[0]?.diff).not.toContain("other");
    expect(diff.uncommitted?.diff).toContain("+export const page = 2;");
    expect(diff.uncommitted?.diff).not.toContain("other");
  });

  it("marks a commit git no longer has as unavailable", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.commit("chore: start", { "src/balance.ts": "export const a = 1;\n" });
    const current = buildRun({ commits: [{ sha: "abcdef1", subject: "feat: landed then removed" }] });
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/balance.ts"], current }));

    // Act
    const res = await getDiff("s1", "src/balance.ts");

    // Assert
    const diff = fileDiffSchema.parse(res.body);
    expect(diff.commits).toEqual([{ sha: "abcdef1", subject: "feat: landed then removed", diff: null, isCut: false }]);
  });

  it("never passes a recorded sha that is not hexadecimal to git", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.commit("chore: start", { "src/balance.ts": "export const a = 1;\n" });
    const current = buildRun({ commits: [{ sha: "--output=pwned", subject: "odd" }] });
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/balance.ts"], current }));

    // Act
    const res = await getDiff("s1", "src/balance.ts");

    // Assert
    expect(fileDiffSchema.parse(res.body).commits).toEqual([]);
  });

  it("cuts a diff longer than the limit", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    const repo = createRepository(root);
    repo.commit("chore: start", { "README.md": "# Ledger\n" });
    repo.write("data.txt", Array.from({ length: 4000 }, (_, i) => `line ${i} ${"y".repeat(60)}`).join("\n"));
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["data.txt"] }));

    // Act
    const res = await getDiff("s1", "data.txt");

    // Assert
    const diff = fileDiffSchema.parse(res.body);
    expect(diff.uncommitted?.isCut).toBe(true);
    expect(diff.uncommitted?.diff.length).toBeLessThanOrEqual(200_000);
  });

  it("says the diff is unavailable when the session's folder is gone", async () => {
    // Arrange
    const root = join(ctx.code.dir, "removed-worktree");
    const current = buildRun({ commits: [{ sha: "abcdef1", subject: "feat: balance" }] });
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/balance.ts"], current }));

    // Act
    const res = await getDiff("s1", "src/balance.ts");

    // Assert
    expect(res.status).toBe(200);
    expect(fileDiffSchema.parse(res.body)).toEqual({ file: "src/balance.ts", isAvailable: false, commits: [], uncommitted: null });
  });

  it("returns 502 when git cannot run, never a diff said unavailable", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    createRepository(root);
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/balance.ts"] }));
    const path = process.env.PATH;
    process.env.PATH = "";

    // Act
    let res: Awaited<ReturnType<typeof getDiff>>;
    try {
      res = await getDiff("s1", "src/balance.ts");
    } finally {
      process.env.PATH = path;
    }

    // Assert
    expect(res.status).toBe(502);
    expect((res.body as ProblemDetails).code).toBe("git_failed");
  });

  it("returns 404 for a file the session did not touch", async () => {
    // Arrange
    const root = ctx.code.folder("ledger");
    createRepository(root);
    ctx.seed.session(buildSessionFile({ sessionId: "s1", root, touchedFiles: ["src/balance.ts"] }));

    // Act
    const res = await getDiff("s1", "../secrets.txt");

    // Assert
    expect(res.status).toBe(404);
    expect((res.body as ProblemDetails).code).toBe("not_found");
  });

  it("returns 404 for a session the export does not hold", async () => {
    // Act
    const res = await getDiff("missing", "src/balance.ts");

    // Assert
    expect(res.status).toBe(404);
  });

  it("returns 400 without a file", async () => {
    // Arrange
    ctx.seed.session(buildSessionFile({ sessionId: "s1", touchedFiles: ["src/balance.ts"] }));

    // Act
    const res = await getDiff("s1");

    // Assert
    expect(res.status).toBe(400);
    expect((res.body as ProblemDetails).errors?.["query.file"]).toBeDefined();
  });
});
