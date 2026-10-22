import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { desktopSessionLinks, sessionArchives } from "../../src/features/sessions/sessions.table.js";
import { sessionsResponseSchema, type Session } from "../../src/features/sessions/sessions.schema.js";
import type { ProblemDetails } from "../../src/shared/errors.js";
import { buildProjectFile, buildRun, buildSessionFile, buildStatusFile } from "../factories.js";
import { createTestContext } from "../setup.js";

const DESKTOP_ID = "local_62342b42-d46b-4dbb-84d3-5d68c3e1f7e9";

describe("sessions routes", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const list = async () => {
    const res = await request(ctx.app).get("/v1/sessions");
    expect(res.status).toBe(200);
    return sessionsResponseSchema.parse(res.body);
  };
  const only = async (): Promise<Session> => {
    const { sessions } = await list();
    expect(sessions).toHaveLength(1);
    return sessions[0];
  };

  describe("GET /v1/sessions", () => {
    it("returns an empty list when the export folder holds nothing", async () => {
      // Act
      const body = await list();

      // Assert
      expect(body).toEqual({ sessions: [], projects: [] });
    });

    it.each([
      ["awaiting-answer"],
      ["awaiting-commit"],
      ["stopped"],
      ["working"],
      ["turn-ended"],
      ["job-done"],
    ] as const)("gives the state of the current run's phase %s", async (phase) => {
      // Arrange
      ctx.seed.session(buildSessionFile({ current: buildRun({ phase }) }));

      // Act
      const session = await only();

      // Assert
      expect(session.state).toBe(phase);
      expect(session.isClosed).toBe(false);
    });

    it("marks a session ended in Claude Code as closed", async () => {
      // Arrange
      ctx.seed.session(buildSessionFile({ status: "ended", current: buildRun({ phase: "stopped" }) }));

      // Act
      const session = await only();

      // Assert
      expect(session.isClosed).toBe(true);
    });

    it("returns what the session waits on, its run's details and its settings", async () => {
      // Arrange
      const file = buildSessionFile({
        root: "C:/code/atelier-web",
        model: null,
        permissionMode: "acceptEdits",
        effort: "medium",
        touchedFiles: ["web/src/cart.ts"],
        writtenAt: "2026-01-01T10:00:00.000Z",
        close: { ok: false, blockers: ["not-done", "pending-commit", "dirty-files", "unknown-blocker"] },
        current: buildRun({
          lane: "build",
          request: ".planning/blueprints/2026-10-22-cart.md",
          blueprint: "2026-10-22-cart",
          step: "stage:2",
          substep: "tests",
          phase: "awaiting-commit",
          pendingCommit: { subject: "feat(cart): keep promo code", body: "Spec: cart ~FR-07" },
          commits: [{ sha: "a41c9e2", subject: "docs(cart): blueprint" }],
          resumePrompt: "/selo:build .planning/blueprints/2026-10-22-cart.md",
        }),
      });
      ctx.seed.session(file);

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({
        id: file.sessionId,
        folder: "C:/code/atelier-web",
        lane: "build",
        blueprint: ".planning/blueprints/2026-10-22-cart.md",
        step: "stage:2",
        substep: "tests",
        pendingCommit: { subject: "feat(cart): keep promo code", body: "Spec: cart ~FR-07" },
        commits: [{ sha: "a41c9e2", subject: "docs(cart): blueprint" }],
        nextAction: "/selo:build .planning/blueprints/2026-10-22-cart.md",
        model: null,
        effort: "medium",
        permissionMode: "acceptEdits",
        touchedFiles: ["web/src/cart.ts"],
        blockers: ["not-done", "pending-commit", "dirty-files"],
        updatedAt: "2026-01-01T10:00:00.000Z",
      });
    });

    it("returns the recap of a finished run", async () => {
      // Arrange
      ctx.seed.session(buildSessionFile({ current: buildRun({ phase: "job-done", recap: { text: "Filter kept.", commits: [] } }) }));

      // Act
      const session = await only();

      // Assert
      expect(session.recap).toBe("Filter kept.");
    });

    it("lists the subagents of the current run only, with their task", async () => {
      // Arrange
      const main = buildRun({ since: "2026-01-01T10:00:00.000Z" });
      const old = buildRun({ agentId: "a-old", request: "Explore", since: "2026-01-01T09:00:00.000Z", phase: "turn-ended" });
      const runner = buildRun({ agentId: "a-1", request: "selo:runner", task: "api tests", since: "2026-01-01T10:05:00.000Z", phase: "working" });
      ctx.seed.session(buildSessionFile({ current: main, runs: [runner, main, old] }));

      // Act
      const session = await only();

      // Assert
      expect(session.subagents).toEqual([{ type: "selo:runner", task: "api tests", state: "working" }]);
    });

    it("removes the wrapper tags at the start of the request and marks a request cut by the export", async () => {
      // Arrange
      const pasted = `<pasted_content id="351f">\nFais une maquette ${"x".repeat(200)}`.slice(0, 200);
      ctx.seed.session(buildSessionFile({ current: buildRun({ request: pasted }) }));

      // Act
      const session = await only();

      // Assert
      expect(session.request.startsWith("Fais une maquette")).toBe(true);
      expect(session.isRequestCut).toBe(true);
    });

    it("drops a context block at the start of the request and keeps the text after it", async () => {
      // Arrange
      const text = '<artifact-view-context artifact="d10">\n{"context":{}}\n</artifact-view-context>\nRefais le header';
      ctx.seed.session(buildSessionFile({ current: buildRun({ request: text }) }));

      // Act
      const session = await only();

      // Assert
      expect(session.request).toBe("Refais le header");
      expect(session.isRequestCut).toBe(false);
    });

    it("groups the sessions of a worktree under their repository's project, each with its own branch", async () => {
      // Arrange
      const main = "C:/code/selo-ops";
      const worktree = "C:/code/selo-ops/.claude/worktrees/live";
      ctx.seed.project(buildProjectFile({ root: main, repo: `${main}/.git`, branch: "main", changedCount: 3, manifest: { name: "selo-ops" } }));
      ctx.seed.project(buildProjectFile({ root: worktree, repo: `${main}/.git`, branch: "claude/live", changedCount: 1, manifest: { name: "selo-ops" } }));
      const inMain = buildSessionFile({ root: main, repo: `${main}/.git` });
      const inWorktree = buildSessionFile({ root: worktree, repo: `${main}/.git` });
      ctx.seed.session(inMain);
      ctx.seed.session(inWorktree);

      // Act
      const { sessions, projects } = await list();

      // Assert
      expect(projects).toEqual([{ id: `${main}/.git`, name: "selo-ops", branch: "main", changedCount: 3 }]);
      const byId = new Map(sessions.map((s) => [s.id, s]));
      expect(byId.get(inMain.sessionId)).toMatchObject({ projectId: `${main}/.git`, branch: "main" });
      expect(byId.get(inWorktree.sessionId)).toMatchObject({ projectId: `${main}/.git`, branch: "claude/live" });
    });

    it("finds the repository of a session file that lacks it through its folder's project file", async () => {
      // Arrange
      const main = "C:/code/selo-ops";
      const worktree = "C:/code/selo-ops/.claude/worktrees/live";
      ctx.seed.project(buildProjectFile({ root: main, manifest: { name: "selo-ops" } }));
      ctx.seed.project(buildProjectFile({ root: worktree, repo: `${main}/.git`, branch: "claude/live", manifest: { name: "selo-ops" } }));
      ctx.seed.session(buildSessionFile({ root: main }));
      ctx.seed.session(buildSessionFile({ root: worktree, repo: null }));

      // Act
      const { sessions, projects } = await list();

      // Assert
      expect(projects.map((p) => p.id)).toEqual([`${main}/.git`]);
      expect(sessions.map((s) => s.projectId)).toEqual([`${main}/.git`, `${main}/.git`]);
    });

    it("skips a session file whose dates are not dates", async () => {
      // Arrange
      const good = buildSessionFile();
      ctx.seed.session(good);
      ctx.seed.session(buildSessionFile({ writtenAt: "yesterday" }));

      // Act
      const { sessions } = await list();

      // Assert
      expect(sessions.map((s) => s.id)).toEqual([good.sessionId]);
    });

    it("gives an empty request when the export cut a leading context block before its end", async () => {
      // Arrange
      const cut = `<artifact-view-context artifact="d10">\n{"context":${"x".repeat(200)}`.slice(0, 200);
      ctx.seed.session(buildSessionFile({ current: buildRun({ request: cut }) }));

      // Act
      const session = await only();

      // Assert
      expect(session.request).toBe("");
      expect(session.isRequestCut).toBe(true);
    });

    it("names a project with no project file after its folder", async () => {
      // Arrange
      ctx.seed.session(buildSessionFile({ root: "C:/code/harbor-mobile", repo: null }));

      // Act
      const { sessions, projects } = await list();

      // Assert
      expect(projects).toEqual([{ id: "C:/code/harbor-mobile", name: "harbor-mobile", branch: null, changedCount: 0 }]);
      expect(sessions[0]).toMatchObject({ projectId: "C:/code/harbor-mobile", branch: null });
    });

    it("skips temporary, unreadable, unknown-version and run-less session files", async () => {
      // Arrange
      const good = buildSessionFile();
      ctx.seed.session(good);
      ctx.seed.raw("sessions", `${good.sessionId}.json.1234.tmp`, JSON.stringify(buildSessionFile()));
      ctx.seed.raw("sessions", "broken.json", "{ not json");
      ctx.seed.raw("sessions", "future.json", JSON.stringify({ ...buildSessionFile(), schemaVersion: 2 }));
      ctx.seed.session(buildSessionFile({ current: null, runs: [] }));

      // Act
      const { sessions } = await list();

      // Assert
      expect(sessions.map((s) => s.id)).toEqual([good.sessionId]);
    });

    it("offers the archive only on a session whose current run is done or whose turn ended", async () => {
      // Arrange
      ctx.seed.session(buildSessionFile({ sessionId: "done", current: buildRun({ phase: "job-done" }) }));
      ctx.seed.session(buildSessionFile({ sessionId: "turn", current: buildRun({ phase: "turn-ended" }) }));
      ctx.seed.session(buildSessionFile({ sessionId: "asking", current: buildRun({ phase: "awaiting-answer" }) }));

      // Act
      const { sessions } = await list();

      // Assert
      const can = Object.fromEntries(sessions.map((s) => [s.id, s.canArchive]));
      expect(can).toEqual({ done: true, turn: true, asking: false });
    });

    it("links a running desktop-app session to the desktop app", async () => {
      // Arrange
      const file = buildSessionFile();
      ctx.seed.session(file);
      ctx.seed.status(buildStatusFile({ sessionId: file.sessionId, hostSessionId: DESKTOP_ID }));

      // Act
      const session = await only();

      // Assert
      expect(session.desktopLink).toBe(`claude://claude.ai/epitaxy/${DESKTOP_ID}`);
      const [stored] = await ctx.db.select().from(desktopSessionLinks);
      expect(stored).toEqual({ sessionId: file.sessionId, desktopSessionId: DESKTOP_ID });
    });

    it("keeps the desktop link once the session's process has ended", async () => {
      // Arrange
      const file = buildSessionFile();
      ctx.seed.session(file);
      ctx.seed.status(buildStatusFile({ sessionId: file.sessionId, hostSessionId: DESKTOP_ID }));
      await list();
      ctx.clearStatus();

      // Act
      const session = await only();

      // Assert
      expect(session.desktopLink).toBe(`claude://claude.ai/epitaxy/${DESKTOP_ID}`);
    });

    it.each([
      ["a CLI session", { entrypoint: "cli" }],
      ["a malformed desktop id", { hostSessionId: "local_../../evil" }],
      ["no desktop id", { hostSessionId: null }],
    ])("gives no desktop link for %s", async (_case, overrides) => {
      // Arrange
      const file = buildSessionFile();
      ctx.seed.session(file);
      ctx.seed.status(buildStatusFile({ sessionId: file.sessionId, hostSessionId: DESKTOP_ID, ...overrides }));

      // Act
      const session = await only();

      // Assert
      expect(session.desktopLink).toBeNull();
      expect(await ctx.db.select().from(desktopSessionLinks)).toEqual([]);
    });

    it("gives no desktop link to a session no status file names, and reads the status files beside an unreadable one", async () => {
      // Arrange
      const linked = buildSessionFile({ sessionId: "linked" });
      ctx.seed.session(linked);
      ctx.seed.session(buildSessionFile({ sessionId: "unnamed" }));
      ctx.seed.rawStatus("123.json", "{ not json");
      ctx.seed.status(buildStatusFile({ sessionId: "linked", hostSessionId: DESKTOP_ID }));

      // Act
      const { sessions } = await list();

      // Assert
      const links = Object.fromEntries(sessions.map((s) => [s.id, s.desktopLink]));
      expect(links).toEqual({ linked: `claude://claude.ai/epitaxy/${DESKTOP_ID}`, unnamed: null });
    });

    it("keeps no desktop link of a session outside the export", async () => {
      // Arrange
      ctx.seed.status(buildStatusFile({ sessionId: "elsewhere", hostSessionId: DESKTOP_ID }));

      // Act
      await list();

      // Assert
      expect(await ctx.db.select().from(desktopSessionLinks)).toEqual([]);
    });
  });

  describe("PUT /v1/sessions/:id/archive", () => {
    it("archives an open session whose turn ended", async () => {
      // Arrange
      ctx.clock.set("2026-03-01T08:00:00.000Z");
      const run = buildRun({ phase: "turn-ended" });
      ctx.seed.session(buildSessionFile({ sessionId: "s1", current: run }));

      // Act
      const res = await request(ctx.app).put("/v1/sessions/s1/archive");

      // Assert
      expect(res.status).toBe(204);
      expect(await ctx.db.select().from(sessionArchives)).toEqual([
        { sessionId: "s1", runId: run.id, archivedAt: new Date("2026-03-01T08:00:00.000Z") },
      ]);
      expect(await only()).toMatchObject({ isArchived: true, canArchive: false });
    });

    it("archives a session whose current run is done, closed or not", async () => {
      // Arrange
      ctx.clock.set("2026-03-01T08:00:00.000Z");
      const run = buildRun({ phase: "job-done" });
      ctx.seed.session(buildSessionFile({ sessionId: "s-closed", status: "ended", current: run }));

      // Act
      const res = await request(ctx.app).put("/v1/sessions/s-closed/archive");

      // Assert
      expect(res.status).toBe(204);
      expect(await ctx.db.select().from(sessionArchives)).toEqual([
        { sessionId: "s-closed", runId: run.id, archivedAt: new Date("2026-03-01T08:00:00.000Z") },
      ]);
      expect(await only()).toMatchObject({ isArchived: true, archivedAt: "2026-03-01T08:00:00.000Z", canArchive: false });
    });

    it.each([["awaiting-answer"], ["awaiting-commit"], ["stopped"], ["working"]] as const)(
      "refuses to archive a session in state %s",
      async (phase) => {
        // Arrange
        ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ phase }) }));

        // Act
        const res = await request(ctx.app).put("/v1/sessions/s1/archive");

        // Assert
        expect(res.status).toBe(422);
        expect((res.body as ProblemDetails).code).toBe("session_not_done");
        expect(await ctx.db.select().from(sessionArchives)).toEqual([]);
      },
    );

    it("keeps one archive when a session is archived twice", async () => {
      // Arrange
      ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ phase: "job-done" }) }));
      await request(ctx.app).put("/v1/sessions/s1/archive").expect(204);

      // Act
      const res = await request(ctx.app).put("/v1/sessions/s1/archive");

      // Assert
      expect(res.status).toBe(204);
      expect(await ctx.db.select().from(sessionArchives)).toHaveLength(1);
    });

    it("returns 404 when the session is not in the export", async () => {
      // Act
      const res = await request(ctx.app).put("/v1/sessions/missing/archive");

      // Assert
      expect(res.status).toBe(404);
      expect((res.body as ProblemDetails).code).toBe("not_found");
    });

    it("brings the session back to the list when a new run starts after the archive", async () => {
      // Arrange
      ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ id: "s1:1", phase: "job-done" }) }));
      await request(ctx.app).put("/v1/sessions/s1/archive").expect(204);
      ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ id: "s1:2", phase: "working" }) }));

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ isArchived: false, archivedAt: null, state: "working" });
    });
  });

  describe("DELETE /v1/sessions/:id/archive", () => {
    it("puts an archived session back in the list", async () => {
      // Arrange
      ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ phase: "job-done" }) }));
      await request(ctx.app).put("/v1/sessions/s1/archive").expect(204);

      // Act
      const res = await request(ctx.app).delete("/v1/sessions/s1/archive");

      // Assert
      expect(res.status).toBe(204);
      expect(await ctx.db.select().from(sessionArchives)).toEqual([]);
      expect(await only()).toMatchObject({ isArchived: false, canArchive: true });
    });

    it("changes nothing when the session is not archived", async () => {
      // Arrange
      ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ phase: "job-done" }) }));

      // Act
      const res = await request(ctx.app).delete("/v1/sessions/s1/archive");

      // Assert
      expect(res.status).toBe(204);
      expect(await ctx.db.select().from(sessionArchives)).toEqual([]);
      expect(await only()).toMatchObject({ isArchived: false, canArchive: true });
    });

    it("returns 404 when the session is not in the export", async () => {
      // Act
      const res = await request(ctx.app).delete("/v1/sessions/missing/archive");

      // Assert
      expect(res.status).toBe(404);
    });
  });
});
