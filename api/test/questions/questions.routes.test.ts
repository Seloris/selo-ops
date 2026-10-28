import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createQuestionRepository } from "../../src/features/questions/questions.repository.js";
import { RunError } from "../../src/features/questions/questions.runner.js";
import { questionSchema, questionsResponseSchema } from "../../src/features/questions/questions.schema.js";
import { questions } from "../../src/features/questions/questions.table.js";
import { sessionsResponseSchema } from "../../src/features/sessions/sessions.schema.js";
import { buildExportBlueprint, buildExportSheet, buildProjectFile, buildRunningStatusFile, rootKeyOf } from "../factories.js";
import { createTestContext } from "../setup.js";

// `question` BR-01 to BR-06: a question asked of a project, answered by a headless run (a fake here, never `claude`).

const slash = (path: string) => path.replace(/\\/g, "/");
const BLUEPRINT = ".planning/blueprints/2026-01-01-due-date.md";
const SHEET = ".planning/pages/home.md";
const TOKENS = { input: 12, cacheRead: 30_000, cacheWrite: 4_000, output: 800 };

describe("questions", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const seedProject = () => {
    const root = slash(ctx.code.repo("ledger-api"));
    ctx.seed.project(buildProjectFile({ root, sheets: [buildExportSheet()], blueprints: [buildExportBlueprint()] }));
    return { root, id: rootKeyOf(root) };
  };

  const ask = (id: string, body: object) => request(ctx.app).post(`/v1/projects/${id}/questions`).send(body);
  const list = async (id: string, path?: string) => {
    const res = await request(ctx.app).get(`/v1/projects/${id}/questions`).query(path === undefined ? {} : { path });
    expect(res.status).toBe(200);
    return questionsResponseSchema.parse(res.body).questions;
  };
  const listSpecs = async (id: string) => {
    const res = await request(ctx.app).get(`/v1/projects/${id}/questions`).query({ kind: "specs" });
    expect(res.status).toBe(200);
    return questionsResponseSchema.parse(res.body).questions;
  };
  const rowsOf = () => ctx.db.select().from(questions);

  describe("POST /v1/projects/{id}/questions", () => {
    it("returns 202 with the question running, then answers it with the run's answer, model, duration and tokens", async () => {
      // Arrange
      const { id, root } = seedProject();

      // Act
      const res = await ask(id, { path: BLUEPRINT, preset: "explain" });

      // Assert
      expect(res.status).toBe(202);
      const question = questionSchema.parse(res.body);
      expect(question).toMatchObject({ projectId: id, path: BLUEPRINT, targetKind: "blueprint", preset: "explain", text: null, state: "running", answer: null, tokens: null });
      expect(ctx.runs).toHaveLength(1);
      expect(ctx.runs[0]?.input.cwd).toBe(root);
      ctx.clock.set("2026-01-01T00:01:00.000Z");
      ctx.runs[0]?.resolve({ answer: "**Résumé**", model: "claude-sonnet-5-5", durationMs: 41_000, tokens: TOKENS });
      await vi.waitFor(async () => expect((await list(id, BLUEPRINT))[0]?.state).toBe("answered"));
      const [answered] = await list(id, BLUEPRINT);
      expect(answered).toMatchObject({ answer: "**Résumé**", model: "claude-sonnet-5-5", durationMs: 41_000, tokens: TOKENS, error: null, answeredAt: "2026-01-01T00:01:00.000Z" });
      const [row] = await rowsOf();
      expect(row?.state).toBe("answered");
    });

    it("trims a free text and runs it in the base checkout for the whole project", async () => {
      // Arrange
      const { id, root } = seedProject();

      // Act
      const res = await ask(id, { text: "  Quelles pages restent sans spec ?  " });

      // Assert
      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({ path: null, targetKind: "project", text: "Quelles pages restent sans spec ?" });
      expect(ctx.runs[0]?.input.cwd).toBe(root);
      expect(ctx.runs[0]?.input.prompt).toContain("Quelles pages restent sans spec ?");
      expect(ctx.runs[0]?.input.prompt).toContain("the whole project");
    });

    it("runs a question on all the specs in the base checkout, the prompt naming the pages and domain sheets", async () => {
      // Arrange
      const { id, root } = seedProject();

      // Act
      const res = await ask(id, { kind: "specs", text: "Quelles règles se contredisent ?" });

      // Assert
      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({ path: null, targetKind: "specs", preset: null, text: "Quelles règles se contredisent ?" });
      expect(ctx.runs[0]?.input.cwd).toBe(root);
      const prompt = ctx.runs[0]?.input.prompt ?? "";
      expect(prompt).toContain("`.planning/pages/`");
      expect(prompt).toContain("`.planning/domain/`");
      expect(prompt).not.toContain("the whole project");
    });

    it("names the target's path and kind in the prompt, and asks for French", async () => {
      // Arrange
      const { id } = seedProject();

      // Act
      await ask(id, { path: SHEET, preset: "explain" });

      // Assert
      const prompt = ctx.runs[0]?.input.prompt ?? "";
      expect(prompt).toContain(`\`${SHEET}\``);
      expect(prompt).toContain("spec");
      expect(prompt).toContain("Answer in French");
      expect(prompt).toContain("never run a command");
    });

    it("runs a worktree's own blueprint in that worktree", async () => {
      // Arrange
      const { root, id } = seedProject();
      const worktree = slash(ctx.code.folder("ledger-api-wt"));
      const file = ".planning/blueprints/2026-01-02-tags.md";
      ctx.seed.project(buildProjectFile({ root: worktree, repo: `${root}/.git`, branch: "claude/tags", blueprints: [buildExportBlueprint({ name: "2026-01-02-tags" })] }));

      // Act
      const res = await ask(id, { path: file, text: "Pourquoi ?" });

      // Assert
      expect(res.status).toBe(202);
      expect(ctx.runs[0]?.input.cwd).toBe(worktree);
    });

    it("fails the question with the run's reason when the run errs", async () => {
      // Arrange
      const { id } = seedProject();
      await ask(id, { path: BLUEPRINT, preset: "explain" });

      // Act
      ctx.runs[0]?.reject(new RunError("missing-binary", "spawn claude ENOENT"));

      // Assert
      await vi.waitFor(async () => expect((await list(id, BLUEPRINT))[0]?.state).toBe("failed"));
      expect((await list(id, BLUEPRINT))[0]).toMatchObject({ error: "missing-binary", errorDetail: "spawn claude ENOENT", answer: null });
    });

    it("refuses a fourth question while three run, and keeps nothing", async () => {
      // Arrange
      const { id } = seedProject();
      for (let i = 0; i < 3; i += 1) expect((await ask(id, { text: `Question ${i}` })).status).toBe(202);

      // Act
      const res = await ask(id, { text: "Question 4" });

      // Assert
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("question_limit");
      expect(await rowsOf()).toHaveLength(3);
      expect(ctx.runs).toHaveLength(3);
    });

    it("accepts a new question once a run ends", async () => {
      // Arrange
      const { id } = seedProject();
      for (let i = 0; i < 3; i += 1) await ask(id, { text: `Question ${i}` });
      ctx.runs[0]?.resolve({ answer: "ok", model: "sonnet", durationMs: 1, tokens: null });
      await vi.waitFor(async () => expect((await rowsOf()).filter((r) => r.state === "answered")).toHaveLength(1));

      // Act
      const res = await ask(id, { text: "Question 4" });

      // Assert
      expect(res.status).toBe(202);
    });

    it("returns 404 for an unknown project", async () => {
      // Act
      const res = await ask("nope", { text: "Bonjour" });

      // Assert
      expect(res.status).toBe(404);
      expect(await rowsOf()).toHaveLength(0);
    });

    it("returns 404 for a file that is no blueprint nor sheet of the project", async () => {
      // Arrange
      const { id } = seedProject();

      // Act
      const responses = await Promise.all([".planning/ideas.md", "../secret.md", ".planning/pages/other.md"].map((path) => ask(id, { path, preset: "explain" })));

      // Assert
      expect(responses.map((r) => r.status)).toEqual([404, 404, 404]);
      expect(ctx.runs).toHaveLength(0);
    });

    it.each([
      ["an empty text", { text: "   " }],
      ["a text of 2001 characters", { text: "a".repeat(2001) }],
      ["a preset on the whole project", { preset: "explain" }],
      ["a preset on all the specs", { kind: "specs", preset: "explain" }],
      ["all the specs with a file", { kind: "specs", path: BLUEPRINT, text: "Bonjour" }],
      ["the « Résume » preset, gone", { path: BLUEPRINT, preset: "summary" }],
      ["neither preset nor text", { path: BLUEPRINT }],
      ["both a preset and a text", { path: BLUEPRINT, preset: "explain", text: "Bonjour" }],
      ["an unknown preset", { path: BLUEPRINT, preset: "translate" }],
    ])("returns 400 for %s", async (_name, body) => {
      // Arrange
      const { id } = seedProject();

      // Act
      const res = await ask(id, body);

      // Assert
      expect(res.status).toBe(400);
      expect(await rowsOf()).toHaveLength(0);
    });

    it("accepts a text of 2000 characters", async () => {
      // Arrange
      const { id } = seedProject();

      // Act
      const res = await ask(id, { text: "a".repeat(2000) });

      // Assert
      expect(res.status).toBe(202);
    });
  });

  describe("GET /v1/projects/{id}/questions", () => {
    it("lists one target's questions, newest first", async () => {
      // Arrange
      const { id } = seedProject();
      await ask(id, { path: BLUEPRINT, text: "Première" });
      ctx.clock.set("2026-01-01T00:05:00.000Z");
      await ask(id, { path: BLUEPRINT, text: "Seconde" });
      await ask(id, { path: SHEET, text: "Sur la page" });
      ctx.runs[0]?.resolve({ answer: "ok", model: "sonnet", durationMs: 1, tokens: null });
      await vi.waitFor(async () => expect((await rowsOf()).filter((r) => r.state === "answered")).toHaveLength(1));
      await ask(id, { text: "Sur le projet" });
      ctx.runs[1]?.resolve({ answer: "ok", model: "sonnet", durationMs: 1, tokens: null });
      await vi.waitFor(async () => expect((await rowsOf()).filter((r) => r.state === "answered")).toHaveLength(2));
      await ask(id, { kind: "specs", text: "Sur les specs" });

      // Act
      const onBlueprint = await list(id, BLUEPRINT);
      const onProject = await list(id);
      const onSpecs = await listSpecs(id);

      // Assert
      expect(onBlueprint.map((q) => q.text)).toEqual(["Seconde", "Première"]);
      expect(onProject.map((q) => q.text)).toEqual(["Sur le projet"]);
      expect(onSpecs.map((q) => q.text)).toEqual(["Sur les specs"]);
    });

    it("keeps a file's questions once the file is gone", async () => {
      // Arrange
      const { id, root } = seedProject();
      await ask(id, { path: BLUEPRINT, text: "Encore là ?" });
      ctx.seed.project(buildProjectFile({ root, sheets: [], blueprints: [] }));

      // Act
      const listed = await list(id, BLUEPRINT);

      // Assert
      expect(listed.map((q) => q.text)).toEqual(["Encore là ?"]);
    });
  });

  describe("DELETE /v1/questions/{id}", () => {
    it("deletes a running question and stops its run", async () => {
      // Arrange
      const { id } = seedProject();
      const asked = await ask(id, { path: BLUEPRINT, preset: "explain" });

      // Act
      const res = await request(ctx.app).delete(`/v1/questions/${asked.body.id}`);

      // Assert
      expect(res.status).toBe(204);
      expect(ctx.runs[0]?.input.signal.aborted).toBe(true);
      expect(await rowsOf()).toHaveLength(0);
    });

    it("deletes an answered question", async () => {
      // Arrange
      const { id } = seedProject();
      const asked = await ask(id, { text: "Bonjour" });
      ctx.runs[0]?.resolve({ answer: "Salut", model: "sonnet", durationMs: 1, tokens: null });
      await vi.waitFor(async () => expect((await rowsOf())[0]?.state).toBe("answered"));

      // Act
      const res = await request(ctx.app).delete(`/v1/questions/${asked.body.id}`);

      // Assert
      expect(res.status).toBe(204);
      expect(await rowsOf()).toHaveLength(0);
    });

    it("returns 404 for an unknown question", async () => {
      // Act
      const res = await request(ctx.app).delete("/v1/questions/nope");

      // Assert
      expect(res.status).toBe(404);
    });
  });

  describe("start-up", () => {
    it("marks the questions left running « Interrompue »", async () => {
      // Arrange
      const { id } = seedProject();
      const asked = await ask(id, { text: "Bonjour" });

      // Act
      await createQuestionRepository(ctx.db).interruptRunning(ctx.clock.now());

      // Assert
      const [row] = await ctx.db.select().from(questions).where(eq(questions.id, asked.body.id));
      expect(row).toMatchObject({ state: "failed", error: "interrupted" });
    });
  });

  describe("migration", () => {
    it("deletes the questions asked with the « Résume » preset, and keeps the others", async () => {
      // Arrange
      const { id } = seedProject();
      const repo = createQuestionRepository(ctx.db);
      const row = (preset: string | null, text: string | null) => ({
        id: randomUUID(), projectId: id, targetKind: "blueprint", path: BLUEPRINT, preset, text, state: "answered", answer: "ok", error: null, errorDetail: null,
        model: "sonnet", durationMs: 1, inputTokens: null, cacheReadTokens: null, cacheWriteTokens: null, outputTokens: null, runSessionId: randomUUID(), askedAt: ctx.clock.now(), answeredAt: ctx.clock.now(),
      });
      await repo.insert(row("summary", null));
      await repo.insert(row("explain", null));
      await repo.insert(row(null, "Libre"));
      const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
      const file = readdirSync(dir).find((f) => f.endsWith(".sql") && readFileSync(join(dir, f), "utf8").includes("DELETE FROM \"questions\""));

      // Act
      await ctx.db.execute(sql.raw(readFileSync(join(dir, file ?? "missing.sql"), "utf8")));

      // Assert
      const rows = await rowsOf();
      expect(rows.map((r) => r.preset ?? r.text).sort()).toEqual(["Libre", "explain"]);
    });
  });

  describe("sessions", () => {
    it("never lists a question's run as a session outside selo", async () => {
      // Arrange
      const { id, root } = seedProject();
      await ask(id, { text: "Bonjour" });
      const [row] = await rowsOf();
      ctx.seed.running(buildRunningStatusFile({ sessionId: row?.runSessionId ?? "", cwd: root, entrypoint: "sdk-cli" }));
      ctx.seed.running(buildRunningStatusFile({ cwd: root }));

      // Act
      const res = await request(ctx.app).get("/v1/sessions");

      // Assert
      const sessions = sessionsResponseSchema.parse(res.body).sessions;
      expect(sessions).toHaveLength(1);
      expect(sessions.map((s) => s.id)).not.toContain(row?.runSessionId);
    });
  });
});

describe("questions timeout", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext({ questionTimeoutMs: 30 });
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  it("stops a run past its time and fails the question", async () => {
    // Arrange
    const root = slash(ctx.code.repo("ledger-api"));
    ctx.seed.project(buildProjectFile({ root }));
    const id = rootKeyOf(root);

    // Act
    await request(ctx.app).post(`/v1/projects/${id}/questions`).send({ text: "Lent" });

    // Assert
    await vi.waitFor(async () => expect((await ctx.db.select().from(questions))[0]?.state).toBe("failed"));
    expect((await ctx.db.select().from(questions))[0]).toMatchObject({ error: "timeout" });
    expect(ctx.runs[0]?.input.signal.aborted).toBe(true);
  });
});
