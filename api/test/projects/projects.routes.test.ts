import { mkdirSync, writeFileSync } from "node:fs";
import { uptime } from "node:os";
import { dirname, join } from "node:path";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { projectFileResponseSchema, projectsResponseSchema } from "../../src/features/projects/projects.schema.js";
import { sessionsResponseSchema } from "../../src/features/sessions/sessions.schema.js";
import { buildExportBlueprint, buildExportMockup, buildExportSheet, buildProjectFile, buildRun, buildSessionFile, rootKeyOf } from "../factories.js";
import { createTestContext } from "../setup.js";

// `project` BR-01 to BR-04: the projects of the export, merged per repository, their specs read from the base checkout.

const slash = (path: string) => path.replace(/\\/g, "/");

describe("projects", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const writeFile = (root: string, path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };

  const list = async () => {
    const res = await request(ctx.app).get("/v1/projects");
    expect(res.status).toBe(200);
    return projectsResponseSchema.parse(res.body).projects;
  };

  const readFile = (id: string, path: string) => request(ctx.app).get(`/v1/projects/${id}/file`).query({ path });

  // A base checkout on main, with a worktree on its own branch.
  const seedRepoWithWorktree = () => {
    const root = slash(ctx.code.repo("ledger-api"));
    const worktree = slash(ctx.code.folder("ledger-api-wt"));
    ctx.seed.project(
      buildProjectFile({
        root,
        selo: "2.4.0",
        baseBranch: "main",
        unpushedCount: 3,
        changedCount: 2,
        sheets: [buildExportSheet()],
        blueprints: [buildExportBlueprint({ name: "2026-01-01-due-date", title: "Base copy" })],
      }),
    );
    ctx.seed.project(
      buildProjectFile({
        root: worktree,
        repo: `${root}/.git`,
        branch: "claude/tags",
        aheadCount: 4,
        changedCount: 1,
        sheets: [buildExportSheet({ title: "Worktree copy" })],
        blueprints: [
          buildExportBlueprint({ name: "2026-01-01-due-date", title: "Worktree copy" }),
          buildExportBlueprint({ name: "2026-01-02-tags", title: "Tags", state: "ready" }),
        ],
      }),
    );
    return { root, worktree };
  };

  describe("GET /v1/projects", () => {
    it("returns a project with its sheets, blueprints and git counts", async () => {
      // Arrange
      const { root } = seedRepoWithWorktree();

      // Act
      const [project] = await list();

      // Assert
      expect(project).toMatchObject({
        id: rootKeyOf(root),
        name: "ledger-api",
        root,
        branch: "main",
        baseBranch: "main",
        seloVersion: "2.4.0",
        changedCount: 2,
        unpushedCount: 3,
        hasPlanning: true,
        error: null,
      });
      expect(project?.sheets).toEqual([
        {
          kind: "page",
          slug: "home",
          component: null,
          file: ".planning/pages/home.md",
          title: "Home",
          route: "/",
          isStub: false,
          frCount: 3,
          brCount: 0,
          questionCount: 0,
          nextFr: "FR-04",
          nextBr: "BR-01",
          lastCommit: { sha: "a1b2c3d", subject: "feat(home): list", at: "2026-01-01T00:00:00.000Z" },
          // The worktree's own open blueprint touches it too.
          openBlueprints: ["2026-01-02-tags", "2026-01-01-due-date"],
        },
      ]);
      expect(project?.blueprints[1]).toMatchObject({
        name: "2026-01-01-due-date",
        state: "building",
        stages: [
          { number: 1, component: "api", commit: "feat(due-date): api — due date", sha: "1111111", isDone: true },
          { number: 2, component: "web", commit: "feat(due-date): web — due date", sha: null, isDone: false },
        ],
        isReviewDone: false,
        isSpecMerged: false,
        nextPrompt: "/selo-flow:build .planning/blueprints/2026-01-01-due-date.md",
        decisions: ["Format → day only (no time)"],
      });
    });

    it("merges a worktree into its repository's project, its own blueprints added with its branch", async () => {
      // Arrange
      const { worktree } = seedRepoWithWorktree();

      // Act
      const projects = await list();

      // Assert
      expect(projects).toHaveLength(1);
      expect(projects[0]?.worktrees).toEqual([{ root: worktree, branch: "claude/tags", aheadCount: 4, changedCount: 1 }]);
      expect(projects[0]?.sheets.map((s) => s.title)).toEqual(["Home"]);
      expect(projects[0]?.blueprints.map((b) => [b.name, b.title, b.worktreeBranch])).toEqual([
        ["2026-01-02-tags", "Tags", "claude/tags"],
        ["2026-01-01-due-date", "Base copy", null],
      ]);
    });

    it("lists the mockups to build, validated and not committed, a worktree's own with its branch", async () => {
      // Arrange
      const root = slash(ctx.code.repo("ledger-api"));
      const worktree = slash(ctx.code.folder("ledger-api-wt"));
      ctx.seed.project(
        buildProjectFile({
          root,
          sheets: [buildExportSheet()],
          mockups: [
            buildExportMockup(),
            buildExportMockup({ file: ".planning/mockups/2026-01-04-tags.html", title: "Tags", validated: false }),
            buildExportMockup({ file: ".planning/mockups/2026-01-02-home.html", title: "Home", committed: true }),
          ],
        }),
      );
      ctx.seed.project(
        buildProjectFile({
          root: worktree,
          repo: `${root}/.git`,
          branch: "claude/export",
          mockups: [buildExportMockup({ title: "Worktree copy" }), buildExportMockup({ file: ".planning/mockups/2026-01-05-export.html", title: "Export" })],
        }),
      );

      // Act
      const [project] = await list();

      // Assert
      expect(project?.mockups).toEqual([
        { file: ".planning/mockups/2026-01-05-export.html", title: "Export", worktreeBranch: "claude/export" },
        { file: ".planning/mockups/2026-01-03-due-date.html", title: "Due date", worktreeBranch: null },
      ]);
    });

    it("lists a worktree's committed mockup with its branch until the base checkout holds a file of that name", async () => {
      // Arrange
      const root = slash(ctx.code.repo("ledger-api"));
      const worktree = slash(ctx.code.folder("ledger-api-wt"));
      ctx.seed.project(
        buildProjectFile({
          root,
          sheets: [buildExportSheet()],
          mockups: [
            buildExportMockup({ file: ".planning/mockups/2026-01-02-home.html", title: "Home", committed: true }),
            buildExportMockup({ file: ".planning/mockups/2026-01-06-landed.html", title: "Landed", committed: true }),
          ],
        }),
      );
      ctx.seed.project(
        buildProjectFile({
          root: worktree,
          repo: `${root}/.git`,
          branch: "claude/export",
          mockups: [
            buildExportMockup({ file: ".planning/mockups/2026-01-02-home.html", title: "Home", committed: true }),
            buildExportMockup({ file: ".planning/mockups/2026-01-06-landed.html", title: "Landed", committed: false }),
            buildExportMockup({ file: ".planning/mockups/2026-01-07-export.html", title: "Export", committed: true }),
            buildExportMockup({ file: ".planning/mockups/2026-01-08-draft.html", title: "Draft", validated: false, committed: true }),
          ],
        }),
      );

      // Act
      const [project] = await list();

      // Assert
      expect(project?.mockups).toEqual([{ file: ".planning/mockups/2026-01-07-export.html", title: "Export", worktreeBranch: "claude/export" }]);
    });

    it("lists no mockup when the export gives none", async () => {
      // Arrange
      seedRepoWithWorktree();

      // Act
      const [project] = await list();

      // Assert
      expect(project?.mockups).toEqual([]);
    });

    it("lists a folder of a bigger repository on the base checkout's branch as a project of its own", async () => {
      // Arrange
      const root = slash(ctx.code.repo("factory"));
      const nested = `${root}/samples/todo-app`;
      ctx.seed.project(buildProjectFile({ root, manifest: null }));
      ctx.seed.project(buildProjectFile({ root: nested, repo: `${root}/.git`, manifest: null, sheets: [buildExportSheet()] }));

      // Act
      const projects = await list();

      // Assert
      expect(projects.map((p) => [p.name, p.hasPlanning, p.sheets.length, p.worktrees.length])).toEqual([
        ["factory", false, 0, 0],
        ["todo-app", true, 1, 0],
      ]);
    });

    it("lists a folder nested in a worktree, on its branch, as a project of its own, not a worktree", async () => {
      // Arrange
      const root = slash(ctx.code.repo("factory"));
      const worktree = `${root}/.claude/worktrees/x`;
      ctx.seed.project(buildProjectFile({ root, manifest: null }));
      ctx.seed.project(buildProjectFile({ root: worktree, repo: `${root}/.git`, branch: "claude/x", manifest: null }));
      ctx.seed.project(buildProjectFile({ root: `${worktree}/samples/todo-app`, repo: `${root}/.git`, branch: "claude/x", manifest: null, sheets: [buildExportSheet()] }));

      // Act
      const projects = await list();

      // Assert
      expect(projects.map((p) => [p.name, p.worktrees.map((w) => w.branch), p.sheets.length])).toEqual([
        ["factory", ["claude/x"], 0],
        ["todo-app", [], 1],
      ]);
    });

    it("lists a project with no selo planning with its git counts only", async () => {
      // Arrange
      ctx.seed.project(buildProjectFile({ root: "C:/code/plain", manifest: null, unpushedCount: 5, changedCount: 2 }));

      // Act
      const [project] = await list();

      // Assert
      expect(project).toMatchObject({ name: "plain", hasPlanning: false, unpushedCount: 5, changedCount: 2, sheets: [], blueprints: [], ideaCount: 0, debtCount: 0 });
    });

    it("keeps the planning of a project whose export reports an error, with the error", async () => {
      // Arrange
      ctx.seed.project(buildProjectFile({ manifest: null, error: "Manifest: unknown skin", sheets: [buildExportSheet()] }));

      // Act
      const [project] = await list();

      // Assert
      expect(project).toMatchObject({ hasPlanning: true, error: "Manifest: unknown skin" });
      expect(project?.sheets).toHaveLength(1);
    });

    it("drops a malformed sheet or blueprint and keeps the file for the sessions", async () => {
      // Arrange
      ctx.seed.project(
        buildProjectFile({
          sheets: [buildExportSheet(), { slug: "broken" }] as never,
          blueprints: [buildExportBlueprint(), buildExportBlueprint({ name: "x", state: "unknown" as never })],
          mockups: [buildExportMockup(), { file: ".planning/mockups/x.html" }] as never,
          selo: 42 as never,
        }),
      );
      ctx.seed.session(buildSessionFile());

      // Act
      const [project] = await list();
      const sessions = sessionsResponseSchema.parse((await request(ctx.app).get("/v1/sessions")).body);

      // Assert
      expect(project?.sheets).toHaveLength(1);
      expect(project?.blueprints.map((b) => b.name)).toEqual(["2026-01-01-due-date"]);
      expect(project?.mockups.map((m) => m.title)).toEqual(["Due date"]);
      expect(project?.seloVersion).toBeNull();
      expect(sessions.projects[0]?.name).toBe("ledger-api");
    });

    it("drops planning lists that are not lists", async () => {
      // Arrange
      ctx.seed.project(buildProjectFile({ sheets: "oops" as never, blueprints: [buildExportBlueprint()] }));

      // Act
      const [project] = await list();

      // Assert
      expect(project?.sheets).toEqual([]);
      expect(project?.blueprints).toHaveLength(1);
    });

    it("gives a legacy blueprint no progress", async () => {
      // Arrange
      ctx.seed.project(buildProjectFile({ blueprints: [buildExportBlueprint({ state: "legacy", next: null })] }));

      // Act
      const [project] = await list();

      // Assert
      expect(project?.blueprints[0]).toMatchObject({ state: "legacy", stages: [], nextPrompt: null });
    });

    it("flags a page stub from its file's status line", async () => {
      // Arrange
      const root = slash(ctx.code.repo("ledger-api"));
      ctx.seed.project(buildProjectFile({ root, sheets: [buildExportSheet(), buildExportSheet({ slug: "balance", file: ".planning/pages/balance.md" })] }));
      writeFile(root, ".planning/pages/home.md", "# Home\n\nRoute: `/`\n\n- **FR-01** — A list.\n");
      writeFile(root, ".planning/pages/balance.md", "# Balance\n\nRoute: `/balance`\nStatus: to bootstrap\n");

      // Act
      const [project] = await list();

      // Assert
      expect(project?.sheets.map((s) => [s.slug, s.isStub])).toEqual([["home", false], ["balance", true]]);
    });

    it("counts a sheet's open questions from its file, retired ids left out", async () => {
      // Arrange
      const root = slash(ctx.code.repo("ledger-api"));
      ctx.seed.project(buildProjectFile({ root, sheets: [buildExportSheet()] }));
      writeFile(root, ".planning/pages/home.md", "# Home\n\n- **FR-01** — A list.\n\n## Open questions\n\n- **Q-02** — Sort?\n- **Q-03** — Paging?\n\nRetired: Q-01\n");

      // Act
      const [project] = await list();

      // Assert
      expect(project?.sheets[0]?.questionCount).toBe(2);
    });

    it("counts no open question when the sheet's file cannot be read", async () => {
      // Arrange
      const root = slash(ctx.code.repo("ledger-api"));
      ctx.seed.project(buildProjectFile({ root, sheets: [buildExportSheet()] }));

      // Act
      const [project] = await list();

      // Assert
      expect(project?.sheets[0]?.questionCount).toBe(0);
    });

    it("counts the ideas and technical debts of the base checkout", async () => {
      // Arrange
      const root = slash(ctx.code.repo("ledger-api"));
      ctx.seed.project(buildProjectFile({ root, sheets: [buildExportSheet()] }));
      writeFile(root, ".planning/ideas.md", "# Ideas\n\nFormat: `- {date} — idea`.\n\n## app\n\n- 2026-01-01 — **One:** a.\n- 2026-01-02 — **Two:** b.\n");
      writeFile(root, ".planning/technical-debt.md", "# Technical debt\n\n- **Debt (api):** c.\n");

      // Act
      const [project] = await list();

      // Assert
      expect(project).toMatchObject({ ideaCount: 2, debtCount: 1 });
    });

    it("gives each blueprint and project the live sessions working in its checkouts", async () => {
      // Arrange
      const { root, worktree } = seedRepoWithWorktree();
      const onBase = buildSessionFile({ root, current: buildRun({ blueprint: "2026-01-01-due-date" }) });
      const onWorktree = buildSessionFile({ root: worktree, repo: `${root}/.git`, current: buildRun({ blueprint: "2026-01-02-tags" }) });
      const ended = buildSessionFile({ root, status: "ended", current: buildRun({ blueprint: "2026-01-01-due-date" }) });
      const elsewhere = buildSessionFile({ root: "C:/code/other", current: buildRun({ blueprint: "2026-01-01-due-date" }) });
      for (const s of [onBase, onWorktree, ended, elsewhere]) ctx.seed.session(s);

      // Act
      const [project] = await list();

      // Assert
      expect(project?.sessionIds.sort()).toEqual([onBase.sessionId, onWorktree.sessionId].sort());
      expect(project?.blueprints.map((b) => [b.name, b.sessionIds])).toEqual([
        ["2026-01-02-tags", [onWorktree.sessionId]],
        ["2026-01-01-due-date", [onBase.sessionId]],
      ]);
    });

    it("lists the slots of its checkouts, running only while live since this boot", async () => {
      // Arrange
      const { root, worktree } = seedRepoWithWorktree();
      const boot = Date.now() - uptime() * 1000;
      const component = (url: string) => ({ name: "api", mode: "dev", url, pid: process.pid });
      const slot = (n: number, rec: object) => writeFile(root, `.git/selo/slots/${n}.json`, JSON.stringify({ slot: n, stoppedAt: null, ...rec }));
      slot(0, { root, pid: process.pid, boot, startedAt: "2026-01-01T10:00:00.000Z", components: [component("http://localhost:3000")] });
      // A run of the previous boot: its pids may be reused by now.
      slot(1, { root: worktree, pid: process.pid, boot: boot - 3_600_000, startedAt: "2026-01-01T09:00:00.000Z", components: [component("http://localhost:3010")] });
      slot(2, { root, pid: process.pid, boot, stoppedAt: "2026-01-01T11:00:00.000Z", components: [] });
      // Another folder of the repository, not one of the project's checkouts.
      slot(3, { root: `${root}/elsewhere`, pid: process.pid, boot, components: [] });
      writeFile(root, ".git/selo/slots/4.json", "not json");

      // Act
      const [project] = await list();

      // Assert
      expect(project?.slots).toEqual([
        { number: 0, root, branch: "main", startedAt: "2026-01-01T10:00:00.000Z", isRunning: true, components: [{ name: "api", mode: "dev", url: "http://localhost:3000" }] },
        { number: 1, root: worktree, branch: "claude/tags", startedAt: "2026-01-01T09:00:00.000Z", isRunning: false, components: [{ name: "api", mode: "dev", url: "http://localhost:3010" }] },
        { number: 2, root, branch: "main", startedAt: null, isRunning: false, components: [] },
      ]);
    });
  });

  describe("GET /v1/projects/{id}/file", () => {
    it("returns the text of a sheet the export lists", async () => {
      // Arrange
      const { root } = seedRepoWithWorktree();
      writeFile(root, ".planning/pages/home.md", "# Home\n");

      // Act
      const res = await readFile(rootKeyOf(root), ".planning/pages/home.md");

      // Assert
      expect(res.status).toBe(200);
      expect(projectFileResponseSchema.parse(res.body)).toEqual({ path: ".planning/pages/home.md", text: "# Home\n" });
    });

    it("reads a blueprint only a worktree holds from that worktree", async () => {
      // Arrange
      const { root, worktree } = seedRepoWithWorktree();
      writeFile(worktree, ".planning/blueprints/2026-01-02-tags.md", "# Tags\n");

      // Act
      const res = await readFile(rootKeyOf(root), ".planning/blueprints/2026-01-02-tags.md");

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.text).toBe("# Tags\n");
    });

    it("reads a blueprint two worktrees hold from the one the list names", async () => {
      // Arrange
      const { root, worktree } = seedRepoWithWorktree();
      const second = slash(ctx.code.folder("ledger-api-wt2"));
      ctx.seed.project(buildProjectFile({ root: second, repo: `${root}/.git`, branch: "claude/other", blueprints: [buildExportBlueprint({ name: "2026-01-02-tags" })] }));
      writeFile(worktree, ".planning/blueprints/2026-01-02-tags.md", "# First");
      writeFile(second, ".planning/blueprints/2026-01-02-tags.md", "# Second");

      // Act
      const [project] = await list();
      const res = await readFile(rootKeyOf(root), ".planning/blueprints/2026-01-02-tags.md");

      // Assert
      const named = project?.blueprints.find((b) => b.name === "2026-01-02-tags")?.worktreeBranch;
      expect(res.body.text).toBe(named === "claude/tags" ? "# First" : "# Second");
    });

    it("returns the ideas and the technical debt", async () => {
      // Arrange
      const { root } = seedRepoWithWorktree();
      writeFile(root, ".planning/ideas.md", "# Ideas\n");
      writeFile(root, ".planning/technical-debt.md", "# Debt\n");

      // Act
      const ideas = await readFile(rootKeyOf(root), ".planning/ideas.md");
      const debt = await readFile(rootKeyOf(root), ".planning/technical-debt.md");

      // Assert
      expect([ideas.status, ideas.body.text, debt.status, debt.body.text]).toEqual([200, "# Ideas\n", 200, "# Debt\n"]);
    });

    it("returns the changelog of the base checkout", async () => {
      // Arrange
      const { root } = seedRepoWithWorktree();
      writeFile(root, ".planning/changelog.md", "# Changelog\n\n## 2026-01-02\n\n- Added — Tags.\n");

      // Act
      const res = await readFile(rootKeyOf(root), ".planning/changelog.md");

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.text).toBe("# Changelog\n\n## 2026-01-02\n\n- Added — Tags.\n");
    });

    it.each([
      ["a file the export does not list", "selo.yaml"],
      ["a path out of the project", "../ledger-api-wt/.planning/blueprints/2026-01-02-tags.md"],
      ["an absolute path", "C:/Windows/win.ini"],
      ["a listed file that cannot be read", ".planning/blueprints/2026-01-01-due-date.md"],
      ["a missing changelog", ".planning/changelog.md"],
    ])("returns 404 for %s", async (_case, path) => {
      // Arrange
      const { root } = seedRepoWithWorktree();
      writeFile(root, "selo.yaml", "name: x\n");

      // Act
      const res = await readFile(rootKeyOf(root), path);

      // Assert
      expect(res.status).toBe(404);
      expect(res.type).toBe("application/problem+json");
    });

    it("returns 404 for an unknown project", async () => {
      // Act
      const res = await readFile("C--nowhere", ".planning/ideas.md");

      // Assert
      expect(res.status).toBe(404);
    });

    it("returns 400 without a path", async () => {
      // Arrange
      const { root } = seedRepoWithWorktree();

      // Act
      const res = await request(ctx.app).get(`/v1/projects/${rootKeyOf(root)}/file`);

      // Assert
      expect(res.status).toBe(400);
    });
  });
});
