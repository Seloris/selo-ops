import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { migrateDatabase, openDatabase } from "../../src/db/client.js";
import { projectFileResponseSchema, projectsResponseSchema } from "../../src/features/projects/projects.schema.js";
import { questionsResponseSchema } from "../../src/features/questions/questions.schema.js";
import { fileDiffSchema, sessionsResponseSchema } from "../../src/features/sessions/sessions.schema.js";
import { settingsSchema } from "../../src/features/settings/settings.schema.js";
import { statsResponseSchema } from "../../src/features/stats/stats.schema.js";
import { seedDemo } from "../../src/seed/demo.js";
import { createDemoQuestionRunner } from "../../src/seed/demo.questions.js";
import { createTestClock } from "../setup.js";

async function demoApp() {
  const dir = mkdtempSync(join(tmpdir(), "selo-ops-demo-test-"));
  const folders = {
    opsDir: join(dir, "selo"),
    claudeSessionsDir: join(dir, "claude", "sessions"),
    claudeProjectsDir: join(dir, "claude", "projects"),
    claudePluginsFile: join(dir, "claude", "plugins", "installed_plugins.json"),
    claudeSettingsFile: join(dir, "claude", "settings.json"),
    codeDir: join(dir, "code"),
    scratchDir: join(dir, "scratch"),
  };
  const db = openDatabase();
  await migrateDatabase(db);
  const clock = createTestClock();
  await seedDemo(db, clock, folders);
  return createApp({ db, clock, ...folders, questionRunner: createDemoQuestionRunner(10) });
}

// Each test seeds a fresh demo, its real repository included (git processes): slower than a route test.
describe("demo", { timeout: 30_000 }, () => {
  it("lists a session waiting on a permission, with the command to allow", async () => {
    // Arrange
    const app = await demoApp();

    // Act
    const res = await request(app).get("/v1/sessions");

    // Assert
    expect(res.status).toBe(200);
    const waiting = sessionsResponseSchema.parse(res.body).sessions.filter((s) => s.state === "awaiting-permission");
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({ isOutsideSelo: false, flow: "pilot", skill: "fastlane", permissionTool: expect.stringMatching(/\S/) });
  });

  it("shows every case of usage the browser test needs", async () => {
    // Arrange
    const app = await demoApp();

    // Act
    const res = await request(app).get("/v1/sessions");

    // Assert
    const sessions = sessionsResponseSchema.parse(res.body).sessions.filter((s) => !s.isOutsideSelo);
    const runs = sessions.flatMap((s) => (s.runUsage ? [s.runUsage] : []));
    expect(runs.some((r) => !r.settled)).toBe(true);
    expect(runs.some((r) => r.partial)).toBe(true);
    expect(runs.some((r) => r.prompts.length === 50)).toBe(true);
    expect(runs.some((r) => r.prompts.some((p) => p.at === null))).toBe(true);
    expect(sessions.some((s) => s.subagents.some((a) => a.usage === null && a.model === null) && s.usage !== null)).toBe(true);
    expect(sessions.some((s) => s.usage === null)).toBe(true);
    // The session whose export model is null takes its run's.
    expect(sessions.find((s) => s.id === "d3b16f74-e0a9-4c25-87d1-4f9e2b6c0a58")?.model).toBe("claude-sonnet-5-5");
  });

  it("lists every exported session with its writer version, and selo installed at two versions", async () => {
    // Arrange
    const app = await demoApp();

    // Act
    const res = await request(app).get("/v1/sessions");

    // Assert
    const { sessions, plugins } = sessionsResponseSchema.parse(res.body);
    const exported = sessions.filter((s) => !s.isOutsideSelo);
    expect(exported.every((s) => s.writtenBy === "2.8.0")).toBe(true);
    expect(plugins).toEqual([
      { name: "selo-flow", versions: ["2.6.0", "2.5.0"] },
      { name: "selo-feed", versions: ["2.8.0"] },
    ]);
  });

  it("shows an interactive pilot, an autonomous pilot on build and a job done with its next steps", async () => {
    // Arrange
    const app = await demoApp();

    // Act
    const res = await request(app).get("/v1/sessions");

    // Assert
    const { sessions } = sessionsResponseSchema.parse(res.body);
    expect(sessions.some((s) => s.flow === "pilot" && s.mode === null)).toBe(true);
    expect(sessions.some((s) => s.flow === "pilot" && s.mode === "autonomous" && s.skill === "build")).toBe(true);
    expect(sessions.some((s) => s.flow === "autopilot")).toBe(false);
    const done = sessions.find((s) => s.state === "job-done" && s.nextSteps.length >= 2);
    expect(done?.nextSteps.map((n) => n.command)).toContain(done?.nextAction);
  });

  it("shows every blueprint state, a worktree's own blueprint and mockup, a project without planning and readable files", async () => {
    // Arrange
    const app = await demoApp();

    // Act
    const res = await request(app).get("/v1/projects");

    // Assert
    const { projects } = projectsResponseSchema.parse(res.body);
    const blueprints = projects.flatMap((p) => p.blueprints);
    expect(new Set(blueprints.map((b) => b.state))).toEqual(new Set(["draft", "ready", "building", "review", "merging", "done", "legacy"]));
    expect(blueprints.some((b) => b.worktreeBranch !== null)).toBe(true);
    expect(projects.flatMap((p) => p.mockups).some((m) => m.worktreeBranch !== null)).toBe(true);
    expect(blueprints.some((b) => b.sessionIds.length > 0)).toBe(true);
    const nextPrompts = blueprints.flatMap((b) => (b.nextPrompt ? [b.nextPrompt] : []));
    expect(nextPrompts.length).toBeGreaterThan(0);
    expect(nextPrompts.every((p) => p.startsWith("/selo-flow:"))).toBe(true);
    expect(projects.some((p) => !p.hasPlanning)).toBe(true);
    expect(projects.some((p) => p.ideaCount > 0 && p.debtCount > 0)).toBe(true);
    for (const p of projects.filter((x) => x.hasPlanning)) {
      for (const file of [...p.sheets.map((s) => s.file), ...p.blueprints.map((b) => b.file), ".planning/ideas.md"]) {
        const read = await request(app).get(`/v1/projects/${p.id}/file`).query({ path: file });
        expect(read.status, `${p.name} ${file}`).toBe(200);
        expect(projectFileResponseSchema.parse(read.body).text).toMatch(/^# /);
      }
    }
    const changelogs = await Promise.all(projects.map((p) => request(app).get(`/v1/projects/${p.id}/file`).query({ path: ".planning/changelog.md" })));
    expect(changelogs.some((r) => r.status === 200 && /^## \d{4}-\d{2}-\d{2}$/m.test(projectFileResponseSchema.parse(r.body).text))).toBe(true);
    expect(changelogs.some((r) => r.status === 404)).toBe(true);
  });

  it("shows a file's committed and uncommitted diff", async () => {
    // Arrange
    const app = await demoApp();
    const id = "d3b16f74-e0a9-4c25-87d1-4f9e2b6c0a58";

    // Act
    const script = await request(app).get(`/v1/sessions/${id}/diff`).query({ file: "selo-run.mjs" });

    // Assert
    const diff = fileDiffSchema.parse(script.body);
    expect(diff.isAvailable).toBe(true);
    expect(diff.commits).toHaveLength(1);
    expect(diff.commits[0]?.diff).toContain("+spawn(");
    expect(diff.uncommitted?.diff).toContain("+spawn(\"node\", [\"scripts/run.mjs\"");
  });

  it("seeds a settings file of its own, its selo settings at their defaults", async () => {
    // Arrange
    const app = await demoApp();

    // Act
    const res = await request(app).get("/v1/settings");

    // Assert
    const settings = settingsSchema.parse(res.body);
    expect(settings.state).toBe("ok");
    expect(settings.path.startsWith(tmpdir())).toBe(true);
    expect(Object.values(settings.values).every((v) => v === null)).toBe(true);
  });

  it("seeds an answered and a failed question on a blueprint the project lists, and answers a new one", async () => {
    // Arrange
    const app = await demoApp();
    const project = projectsResponseSchema.parse((await request(app).get("/v1/projects")).body).projects.find((p) => p.name === "ledger-api");
    const file = ".planning/blueprints/2026-10-20-monthly-balance.md";

    // Act
    const listed = await request(app).get(`/v1/projects/${project?.id ?? ""}/questions`).query({ path: file });
    const asked = await request(app).post(`/v1/projects/${project?.id ?? ""}/questions`).send({ path: file, preset: "explain" });

    // Assert
    expect(project?.blueprints.map((b) => b.file)).toContain(file);
    expect(questionsResponseSchema.parse(listed.body).questions.map((q) => q.state).sort()).toEqual(["answered", "failed"]);
    expect(asked.status).toBe(202);
    await vi.waitFor(async () => {
      const after = questionsResponseSchema.parse((await request(app).get(`/v1/projects/${project?.id ?? ""}/questions`).query({ path: file })).body);
      expect(after.questions[0]?.state).toBe("answered");
    });
  });

  it("gives the stats every flow, two models, an undated part and weeks under all", async () => {
    // Arrange
    const app = await demoApp();

    // Act
    const all = statsResponseSchema.parse((await request(app).get("/v1/stats").query({ period: "all", tz: "Europe/Paris" })).body);
    const week = statsResponseSchema.parse((await request(app).get("/v1/stats").query({ tz: "Europe/Paris" })).body);

    // Assert
    expect(all.granularity).toBe("week");
    expect(all.undated).not.toBeNull();
    expect(new Set(all.flows.map((f) => f.flow))).toEqual(new Set(["free", "fastlane", "blueprint", "pilot", "questions", "undated"]));
    expect(all.models.length).toBeGreaterThanOrEqual(3);
    expect(all.projects.length).toBeGreaterThanOrEqual(3);
    expect(week.totals.questions).toBeGreaterThan(0);
    expect(week.topSessions.length).toBeGreaterThan(0);
  });
});
