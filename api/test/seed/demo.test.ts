import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { migrateDatabase, openDatabase } from "../../src/db/client.js";
import { projectFileResponseSchema, projectsResponseSchema } from "../../src/features/projects/projects.schema.js";
import { sessionsResponseSchema } from "../../src/features/sessions/sessions.schema.js";
import { seedDemo } from "../../src/seed/demo.js";
import { createTestClock } from "../setup.js";

async function demoApp() {
  const dir = mkdtempSync(join(tmpdir(), "selo-ops-demo-test-"));
  const folders = {
    opsDir: join(dir, "selo"),
    claudeSessionsDir: join(dir, "claude", "sessions"),
    claudeProjectsDir: join(dir, "claude", "projects"),
    claudePluginsFile: join(dir, "claude", "plugins", "installed_plugins.json"),
    codeDir: join(dir, "code"),
    scratchDir: join(dir, "scratch"),
  };
  const db = openDatabase();
  await migrateDatabase(db);
  const clock = createTestClock();
  await seedDemo(db, clock, folders);
  return createApp({ db, clock, ...folders });
}

describe("demo", () => {
  it("lists a session waiting on a permission, with the command to allow", async () => {
    // Arrange
    const app = await demoApp();

    // Act
    const res = await request(app).get("/v1/sessions");

    // Assert
    expect(res.status).toBe(200);
    const waiting = sessionsResponseSchema.parse(res.body).sessions.filter((s) => s.state === "awaiting-permission");
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({ isOutsideSelo: false, lane: "fastlane", permissionTool: expect.stringMatching(/\S/) });
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

  it("lists sessions with and without a writer version, and selo installed at two versions", async () => {
    // Arrange
    const app = await demoApp();

    // Act
    const res = await request(app).get("/v1/sessions");

    // Assert
    const { sessions, plugins } = sessionsResponseSchema.parse(res.body);
    const exported = sessions.filter((s) => !s.isOutsideSelo);
    expect(exported.some((s) => s.writtenBy !== null)).toBe(true);
    expect(exported.some((s) => s.writtenBy === null)).toBe(true);
    expect(plugins).toEqual([
      { name: "selo", versions: ["2.2.0", "2.1.0"] },
      { name: "selo-ops", versions: ["2.2.1"] },
    ]);
  });

  it("shows every blueprint state, a worktree's own blueprint, a project without planning and readable files", async () => {
    // Arrange
    const app = await demoApp();

    // Act
    const res = await request(app).get("/v1/projects");

    // Assert
    const { projects } = projectsResponseSchema.parse(res.body);
    const blueprints = projects.flatMap((p) => p.blueprints);
    expect(new Set(blueprints.map((b) => b.state))).toEqual(new Set(["draft", "ready", "building", "review", "merging", "done", "legacy"]));
    expect(blueprints.some((b) => b.worktreeBranch !== null)).toBe(true);
    expect(blueprints.some((b) => b.sessionIds.length > 0)).toBe(true);
    expect(projects.some((p) => !p.hasPlanning)).toBe(true);
    expect(projects.some((p) => p.ideaCount > 0 && p.debtCount > 0)).toBe(true);
    for (const p of projects.filter((x) => x.hasPlanning)) {
      for (const file of [...p.sheets.map((s) => s.file), ...p.blueprints.map((b) => b.file), ".planning/ideas.md"]) {
        const read = await request(app).get(`/v1/projects/${p.id}/file`).query({ path: file });
        expect(read.status, `${p.name} ${file}`).toBe(200);
        expect(projectFileResponseSchema.parse(read.body).text).toMatch(/^# /);
      }
    }
  });
});
