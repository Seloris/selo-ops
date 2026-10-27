import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sessionsResponseSchema } from "../../src/features/sessions/sessions.schema.js";
import { buildRunningStatusFile, buildSessionFile, transcriptFolderOf } from "../factories.js";
import { createTestContext } from "../setup.js";

// The writer's version of a session file, and the selo plugins Claude Code lists as installed (`session` BR-01).

const entry = (version: string, scope = "user") => ({ scope, installPath: `/cache/${version}`, version });

describe("sessions writer and plugin versions", () => {
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

  describe("GET /v1/sessions", () => {
    it("returns the version of the plugin that wrote the session file", async () => {
      // Arrange
      ctx.seed.session({ ...buildSessionFile(), writtenBy: "2.2.1" });

      // Act
      const { sessions } = await list();

      // Assert
      expect(sessions[0].writtenBy).toBe("2.2.1");
    });

    it("returns no writer version for a file written before the field existed", async () => {
      // Arrange
      ctx.seed.session(buildSessionFile());

      // Act
      const { sessions } = await list();

      // Assert
      expect(sessions[0].writtenBy).toBeNull();
    });

    it("returns no writer version for a session outside selo", async () => {
      // Arrange
      const cwd = ctx.code.folder("scratch");
      const status = buildRunningStatusFile({ cwd });
      ctx.seed.running(status);
      ctx.seed.transcript(transcriptFolderOf(cwd), status.sessionId, []);

      // Act
      const { sessions } = await list();

      // Assert
      expect(sessions).toHaveLength(1);
      expect(sessions[0].writtenBy).toBeNull();
    });

    it("returns the installed versions of selo-flow and selo-feed only, highest first", async () => {
      // Arrange
      ctx.seed.plugins(
        JSON.stringify({
          version: 2,
          plugins: {
            "ponytail@ponytail": [entry("5.3.1", "project")],
            "selo@selo": [entry("2.6.0", "project")],
            "selo-ops@selo": [entry("2.6.0")],
            "selo-flow@selo": [entry("2.9.0", "project"), entry("2.10.0", "project"), entry("2.9.0", "project")],
            "selo-feed@selo": [entry("2.2.1")],
          },
        }),
      );

      // Act
      const { plugins } = await list();

      // Assert
      expect(plugins).toEqual([
        { name: "selo-flow", versions: ["2.10.0", "2.9.0"] },
        { name: "selo-feed", versions: ["2.2.1"] },
      ]);
    });

    it("returns no plugin when Claude Code's list of installed plugins is missing", async () => {
      // Act
      const { plugins } = await list();

      // Assert
      expect(plugins).toEqual([]);
    });

    it("returns no plugin when the list of installed plugins is not readable", async () => {
      // Arrange
      ctx.seed.plugins("{ not json");

      // Act
      const res = await request(ctx.app).get("/v1/sessions");

      // Assert
      expect(res.status).toBe(200);
      expect(sessionsResponseSchema.parse(res.body).plugins).toEqual([]);
    });

    it("skips an entry with no version and keeps the others", async () => {
      // Arrange
      ctx.seed.plugins(JSON.stringify({ plugins: { "selo-flow@selo": [{ scope: "project" }, entry("2.1.0", "project")], "selo-feed@selo": "broken" } }));

      // Act
      const { plugins } = await list();

      // Assert
      expect(plugins).toEqual([{ name: "selo-flow", versions: ["2.1.0"] }]);
    });
  });
});
