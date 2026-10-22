import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { migrateDatabase, openDatabase } from "../../src/db/client.js";
import { sessionsResponseSchema } from "../../src/features/sessions/sessions.schema.js";
import { seedDemo } from "../../src/seed/demo.js";
import { createTestClock } from "../setup.js";

async function demoApp() {
  const dir = mkdtempSync(join(tmpdir(), "selo-ops-demo-test-"));
  const folders = {
    opsDir: join(dir, "selo"),
    claudeSessionsDir: join(dir, "claude", "sessions"),
    claudeProjectsDir: join(dir, "claude", "projects"),
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
});
