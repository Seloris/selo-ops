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

describe("demo", () => {
  it("lists a session waiting on a permission, with the command to allow", async () => {
    // Arrange
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
    const app = createApp({ db, clock, ...folders });

    // Act
    const res = await request(app).get("/v1/sessions");

    // Assert
    expect(res.status).toBe(200);
    const waiting = sessionsResponseSchema.parse(res.body).sessions.filter((s) => s.state === "awaiting-permission");
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({ isOutsideSelo: false, lane: "fastlane", permissionTool: expect.stringMatching(/\S/) });
  });
});
