import { join } from "node:path";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { desktopSessionLinks, sessionArchives } from "../../src/features/sessions/sessions.table.js";
import { sessionsResponseSchema, type Session } from "../../src/features/sessions/sessions.schema.js";
import { buildProjectFile, buildRunningStatusFile, buildSessionFile, transcriptFolderOf } from "../factories.js";
import { createTestContext } from "../setup.js";

// Sessions outside selo (`session` BR-12, BR-13): Claude Code's status files of running processes and their transcripts.

const DESKTOP_ID = "local_62342b42-d46b-4dbb-84d3-5d68c3e1f7e9";
// No process has this pid: the status file a crash left behind.
const DEAD_PID = 2 ** 30 + 7;

const slash = (path: string) => path.replace(/\\/g, "/");

const prompt = (text: string, uuid = "u-1") => ({ type: "user", uuid, message: { role: "user", content: text } });
const toolResult = (uuid = "u-tool") => ({
  type: "user",
  uuid,
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] },
});
const meta = (text: string) => ({ type: "user", uuid: "u-meta", isMeta: true, message: { role: "user", content: text } });
const reply = (model: string) => ({ type: "assistant", message: { id: "m1", model, role: "assistant", content: [{ type: "text", text: "Done." }] } });

describe("sessions outside selo", () => {
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
  // A running session in a folder of its own, with its transcript.
  const running = (overrides: Parameters<typeof buildRunningStatusFile>[0] = {}, lines: unknown[] = [prompt("Fix the build")]) => {
    const cwd = overrides.cwd ?? ctx.code.folder("scratch");
    const status = buildRunningStatusFile({ cwd, ...overrides });
    ctx.seed.running(status);
    ctx.seed.transcript(transcriptFolderOf(cwd), status.sessionId, lines);
    return status;
  };

  describe("GET /v1/sessions", () => {
    it("never lists as outside selo a running session whose export file names a transcript that is gone", async () => {
      // Arrange
      const cwd = ctx.code.folder("scratch");
      const status = buildRunningStatusFile({ cwd });
      ctx.seed.running(status);
      ctx.seed.session(buildSessionFile({ sessionId: status.sessionId, root: cwd, transcriptPath: `${cwd}/${status.sessionId}.jsonl` }));

      // Act
      const { sessions } = await list();

      // Assert
      expect(sessions).toEqual([]);
    });

    it("lists a running session that has no export file, outside selo", async () => {
      // Arrange
      const status = running({ statusUpdatedAt: Date.parse("2026-01-01T09:00:00.000Z") });

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({
        id: status.sessionId,
        folder: slash(status.cwd),
        lane: "outside",
        request: "Fix the build",
        isRequestCut: false,
        isRequestImage: false,
        isOutsideSelo: true,
        isClosed: false,
        blueprint: null,
        effort: null,
        permissionMode: null,
        recap: null,
        commits: [],
        blockers: [],
        subagents: [],
        touchedFiles: [],
        nextAction: null,
      });
    });

    it("lists a session of the export once, from its export file, whatever its status file", async () => {
      // Arrange
      const file = buildSessionFile();
      ctx.seed.session(file);
      running({ sessionId: file.sessionId });

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ id: file.sessionId, isOutsideSelo: false, lane: "free" });
    });

    it("leaves out a status file of the export with no run yet", async () => {
      // Arrange
      const file = buildSessionFile({ current: null, runs: [] });
      ctx.seed.session(file);
      running({ sessionId: file.sessionId });

      // Act
      const { sessions } = await list();

      // Assert
      expect(sessions).toEqual([]);
    });

    it("skips the status file of a process that is gone", async () => {
      // Arrange
      running({ pid: DEAD_PID });

      // Act
      const { sessions, projects } = await list();

      // Assert
      expect(sessions).toEqual([]);
      expect(projects).toEqual([]);
    });

    it.each([
      ["busy", undefined, "working"],
      ["running", undefined, "working"],
      ["idle", undefined, "turn-ended"],
      ["waiting", "input needed", "awaiting-answer"],
      ["waiting", "dialog open", "awaiting-answer"],
      ["waiting", "permission prompt", "working"],
      ["waiting", undefined, "working"],
      ["somethingNew", undefined, "working"],
    ] as const)("gives the state of the status %s waiting for %s as %s", async (status, waitingFor, state) => {
      // Arrange
      running({ status, ...(waitingFor === undefined ? {} : { waitingFor }) });

      // Act
      const session = await only();

      // Assert
      expect(session.state).toBe(state);
    });

    it("takes the whole last person prompt over Claude Code's cut last-prompt record", async () => {
      // Arrange
      const long = `<pasted_content>Refais le header ${"x".repeat(250)}</pasted_content>`;
      running({}, [prompt("First"), prompt(long, "u-2"), { type: "last-prompt", lastPrompt: `${long.slice(0, 200)}…`, sessionId: "x" }]);

      // Act
      const session = await only();

      // Assert
      expect(session.request).toBe(`Refais le header ${"x".repeat(250)}`);
      expect(session.isRequestCut).toBe(false);
    });

    it("takes the last last-prompt record when the prompt left the transcript's tail, marked cut when Claude Code cut it", async () => {
      // Arrange
      running({}, [
        toolResult(),
        { type: "last-prompt", lastPrompt: "Old prompt", sessionId: "x" },
        { type: "last-prompt", lastPrompt: `Refais le header ${"x".repeat(183)}…`, sessionId: "x" },
      ]);

      // Act
      const session = await only();

      // Assert
      expect(session.request).toBe(`Refais le header ${"x".repeat(183)}`);
      expect(session.isRequestCut).toBe(true);
    });

    it("skips the command, notification and compact summary lines Claude Code writes as user lines", async () => {
      // Arrange
      running({}, [
        prompt("The real prompt", "u-real"),
        prompt("<command-name>/cost</command-name>\n<command-message>cost</command-message>", "u-cmd"),
        prompt("<local-command-stdout>Total cost: $0.12</local-command-stdout>", "u-out"),
        prompt("<task-notification><task-id>a1</task-id></task-notification>", "u-task"),
        { ...prompt("This session is being continued from a previous conversation…", "u-sum"), isCompactSummary: true, isVisibleInTranscriptOnly: true },
      ]);

      // Act
      const session = await only();

      // Assert
      expect(session.request).toBe("The real prompt");
    });

    it("takes the request from the last person prompt, skipping tool results and meta lines", async () => {
      // Arrange
      running({}, [prompt("First"), "{ cut line", prompt("Second prompt", "u-2"), toolResult(), meta("<command-name>/clear</command-name>")]);

      // Act
      const session = await only();

      // Assert
      expect(session.request).toBe("Second prompt");
    });

    it("takes the request from the session's name when the transcript has no prompt", async () => {
      // Arrange
      running({ name: "Refonte du panier" }, [toolResult()]);

      // Act
      const session = await only();

      // Assert
      expect(session.request).toBe("Refonte du panier");
    });

    it("gives an empty request when neither the transcript nor the name holds one", async () => {
      // Arrange
      const status = buildRunningStatusFile({ cwd: ctx.code.folder("bare") });
      ctx.seed.running(status);

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ request: "", model: null });
    });

    it("gives the model of the last answer", async () => {
      // Arrange
      running({}, [prompt("Go"), reply("claude-sonnet-5-5"), reply("claude-opus-5-5"), reply("<synthetic>")]);

      // Act
      const session = await only();

      // Assert
      expect(session.model).toBe("claude-opus-5-5");
    });

    it("finds the transcript whatever the case of its folder's name", async () => {
      // Arrange
      const cwd = ctx.code.folder("CaseFolder");
      const status = buildRunningStatusFile({ cwd });
      ctx.seed.running(status);
      ctx.seed.transcript(transcriptFolderOf(cwd).toLowerCase(), status.sessionId, [prompt("Lower case folder")]);

      // Act
      const session = await only();

      // Assert
      expect(session.request).toBe("Lower case folder");
    });

    it("finds the transcript in another folder when its own folder has none", async () => {
      // Arrange
      const status = buildRunningStatusFile({ cwd: ctx.code.folder("moved") });
      ctx.seed.running(status);
      ctx.seed.transcript("C--elsewhere", status.sessionId, [prompt("Found elsewhere")]);

      // Act
      const session = await only();

      // Assert
      expect(session.request).toBe("Found elsewhere");
    });

    it("puts a session of a repository in that repository's project, with its branch", async () => {
      // Arrange
      const repo = ctx.code.repo("weather-cli", "develop");
      running({ cwd: join(repo, "src") });

      // Act
      const { sessions, projects } = await list();

      // Assert
      const id = `${slash(repo)}/.git`;
      expect(projects).toEqual([{ id, name: "weather-cli", branch: "develop", changedCount: null }]);
      expect(sessions[0]).toMatchObject({ projectId: id, branch: "develop" });
    });

    it("puts a session of a worktree in its main repository's project, with the worktree's branch", async () => {
      // Arrange
      const repo = ctx.code.repo("weather-cli", "main");
      const worktree = ctx.code.worktree(repo, "weather-wt", "claude/wt");
      running({ cwd: worktree });

      // Act
      const { sessions, projects } = await list();

      // Assert
      const id = `${slash(repo)}/.git`;
      expect(projects).toEqual([{ id, name: "weather-cli", branch: "main", changedCount: null }]);
      expect(sessions[0]).toMatchObject({ projectId: id, branch: "claude/wt" });
    });

    it("makes a folder in no repository its own project", async () => {
      // Arrange
      const folder = ctx.code.folder("notes");
      running({ cwd: folder });

      // Act
      const { sessions, projects } = await list();

      // Assert
      expect(projects).toEqual([{ id: slash(folder), name: "notes", branch: null, changedCount: null }]);
      expect(sessions[0]).toMatchObject({ projectId: slash(folder), branch: null });
    });

    it("joins the project of a selo repository", async () => {
      // Arrange
      const repo = ctx.code.repo("selo-ops");
      const id = `${slash(repo)}/.git`;
      ctx.seed.project(buildProjectFile({ root: slash(repo), repo: id, branch: "main", changedCount: 4, manifest: { name: "Selo Ops" } }));
      ctx.seed.session(buildSessionFile({ root: slash(repo), repo: id }));
      running({ cwd: repo });

      // Act
      const { sessions, projects } = await list();

      // Assert
      expect(projects).toEqual([{ id, name: "Selo Ops", branch: "main", changedCount: 4 }]);
      expect(sessions.map((s) => [s.projectId, s.isOutsideSelo])).toEqual([
        [id, false],
        [id, true],
      ]);
    });

    it("dates the session by its transcript when it changed after the status", async () => {
      // Arrange
      const cwd = ctx.code.folder("dated");
      const status = buildRunningStatusFile({ cwd, statusUpdatedAt: Date.parse("2026-01-01T09:00:00.000Z") });
      ctx.seed.running(status);
      ctx.seed.transcript(transcriptFolderOf(cwd), status.sessionId, [prompt("Go")], "2026-01-01T09:30:00.000Z");

      // Act
      const session = await only();

      // Assert
      expect(session.updatedAt).toBe("2026-01-01T09:30:00.000Z");
    });

    it("dates the session by its status when the transcript is older", async () => {
      // Arrange
      const cwd = ctx.code.folder("dated");
      const status = buildRunningStatusFile({ cwd, statusUpdatedAt: Date.parse("2026-01-01T09:00:00.000Z") });
      ctx.seed.running(status);
      ctx.seed.transcript(transcriptFolderOf(cwd), status.sessionId, [prompt("Go")], "2026-01-01T08:00:00.000Z");

      // Act
      const session = await only();

      // Assert
      expect(session.updatedAt).toBe("2026-01-01T09:00:00.000Z");
    });

    it("dates the creation of a session outside selo by the first dated line of its transcript", async () => {
      // Arrange
      running({ startedAt: Date.parse("2026-01-01T09:00:00.000Z") }, [
        { type: "queue-operation", timestamp: "2026-01-01T06:45:00.000Z" },
        prompt("Go"),
      ]);

      // Act
      const session = await only();

      // Assert
      expect(session.createdAt).toBe("2026-01-01T06:45:00.000Z");
    });

    it("dates the creation of a session outside selo by its process's start when its transcript gives no date", async () => {
      // Arrange
      running({ startedAt: Date.parse("2026-01-01T09:00:00.000Z") }, [prompt("Go")]);

      // Act
      const session = await only();

      // Assert
      expect(session.createdAt).toBe("2026-01-01T09:00:00.000Z");
    });

    it("links a desktop-app session to the desktop app without keeping the link", async () => {
      // Arrange
      running({ entrypoint: "claude-desktop", hostSessionId: DESKTOP_ID });

      // Act
      const session = await only();

      // Assert
      expect(session.desktopLink).toBe(`claude://claude.ai/epitaxy/${DESKTOP_ID}`);
      expect(await ctx.db.select().from(desktopSessionLinks)).toEqual([]);
    });

    it("offers the archive whatever the turn", async () => {
      // Arrange
      running({ sessionId: "idle", status: "idle" });
      running({ sessionId: "busy", status: "busy" });

      // Act
      const { sessions } = await list();

      // Assert
      expect(Object.fromEntries(sessions.map((s) => [s.id, s.canArchive]))).toEqual({ idle: true, busy: true });
    });
  });

  describe("PUT /v1/sessions/:id/archive", () => {
    it("archives a session outside selo whose turn ended, on its last prompt", async () => {
      // Arrange
      ctx.clock.set("2026-03-01T08:00:00.000Z");
      running({ sessionId: "s1", status: "idle" }, [prompt("Go", "prompt-1")]);

      // Act
      const res = await request(ctx.app).put("/v1/sessions/s1/archive");

      // Assert
      expect(res.status).toBe(204);
      expect(await ctx.db.select().from(sessionArchives)).toEqual([
        { sessionId: "s1", runId: "prompt-1", archivedAt: new Date("2026-03-01T08:00:00.000Z") },
      ]);
      expect(await only()).toMatchObject({ isArchived: true, canArchive: false, archivedAt: "2026-03-01T08:00:00.000Z" });
    });

    it("archives a session outside selo while Claude works", async () => {
      // Arrange
      ctx.clock.set("2026-03-01T08:00:00.000Z");
      running({ sessionId: "s1", status: "busy" }, [prompt("Go", "prompt-1")]);

      // Act
      const res = await request(ctx.app).put("/v1/sessions/s1/archive");

      // Assert
      expect(res.status).toBe(204);
      expect(await ctx.db.select().from(sessionArchives)).toEqual([
        { sessionId: "s1", runId: "prompt-1", archivedAt: new Date("2026-03-01T08:00:00.000Z") },
      ]);
    });

    it("returns 404 once the process is gone", async () => {
      // Arrange
      running({ sessionId: "s1", status: "idle", pid: DEAD_PID });

      // Act
      const res = await request(ctx.app).put("/v1/sessions/s1/archive");

      // Assert
      expect(res.status).toBe(404);
    });

    it("keeps the archive when Claude Code writes a command's output after it", async () => {
      // Arrange
      const status = running({ sessionId: "s1", status: "idle" }, [prompt("Go", "prompt-1")]);
      await request(ctx.app).put("/v1/sessions/s1/archive").expect(204);
      ctx.seed.transcript(transcriptFolderOf(status.cwd), "s1", [
        prompt("Go", "prompt-1"),
        prompt("<command-name>/cost</command-name>", "u-cmd"),
        prompt("<local-command-stdout>Total cost: $0.12</local-command-stdout>", "u-out"),
      ]);

      // Act
      const session = await only();

      // Assert
      expect(session.isArchived).toBe(true);
    });

    it("tells the next run by its prompt's text when the prompt left the transcript's tail", async () => {
      // Arrange
      const status = running({ sessionId: "s1", status: "idle" }, [toolResult(), { type: "last-prompt", lastPrompt: "First turn", sessionId: "s1" }]);
      await request(ctx.app).put("/v1/sessions/s1/archive").expect(204);
      const archivedFirst = (await only()).isArchived;
      ctx.seed.transcript(transcriptFolderOf(status.cwd), "s1", [toolResult(), { type: "last-prompt", lastPrompt: "Second turn", sessionId: "s1" }]);

      // Act
      const session = await only();

      // Assert
      expect(archivedFirst).toBe(true);
      expect(session).toMatchObject({ isArchived: false, request: "Second turn" });
    });

    it("brings the session back to the list when the person sends a new prompt", async () => {
      // Arrange
      const status = running({ sessionId: "s1", status: "idle" }, [prompt("Go", "prompt-1")]);
      await request(ctx.app).put("/v1/sessions/s1/archive").expect(204);
      ctx.seed.transcript(transcriptFolderOf(status.cwd), "s1", [prompt("Go", "prompt-1"), prompt("And now this", "prompt-2")]);

      // Act
      const session = await only();

      // Assert
      expect(session).toMatchObject({ isArchived: false, archivedAt: null, request: "And now this" });
    });
  });

  describe("DELETE /v1/sessions/:id/archive", () => {
    it("puts an archived session outside selo back in the list", async () => {
      // Arrange
      running({ sessionId: "s1", status: "idle" });
      await request(ctx.app).put("/v1/sessions/s1/archive").expect(204);

      // Act
      const res = await request(ctx.app).delete("/v1/sessions/s1/archive");

      // Assert
      expect(res.status).toBe(204);
      expect(await ctx.db.select().from(sessionArchives)).toEqual([]);
    });
  });
});
