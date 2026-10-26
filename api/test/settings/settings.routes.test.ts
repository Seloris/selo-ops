import { mkdirSync, rmSync } from "node:fs";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { settingsSchema } from "../../src/features/settings/settings.schema.js";
import type { ProblemDetails } from "../../src/shared/errors.js";
import { createTestContext } from "../setup.js";

// The person's selo settings: the SELO_ keys of the env block of Claude Code's user settings file (`settings` BR-01 to BR-04).

describe("settings routes", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const read = async () => {
    const res = await request(ctx.app).get("/v1/settings");
    expect(res.status).toBe(200);
    return settingsSchema.parse(res.body);
  };
  const save = (body: unknown) => request(ctx.app).patch("/v1/settings").send(body as object);
  const fileJson = () => JSON.parse(ctx.settings.read() ?? "null") as Record<string, unknown>;

  describe("GET /v1/settings", () => {
    it("reads a missing file as every setting at its default", async () => {
      // Act
      const settings = await read();

      // Assert
      expect(settings).toMatchObject({ path: ctx.settings.file, state: "missing", error: null });
      expect(Object.values(settings.values).every((v) => v === null)).toBe(true);
    });

    it("returns the SELO_ values as the file holds them, an unknown one included", async () => {
      // Arrange
      ctx.settings.write(JSON.stringify({ env: { SELO_MODELS: "turbo", SELO_MODEL_REVIEWER: "fable", SELO_ROUTING: "on", OTHER: "x" } }));

      // Act
      const settings = await read();

      // Assert
      expect(settings.state).toBe("ok");
      expect(settings.values).toMatchObject({ SELO_MODELS: "turbo", SELO_MODEL_REVIEWER: "fable", SELO_ROUTING: "on", SELO_COMMIT: null });
      expect(settings.values).not.toHaveProperty("OTHER");
    });

    it("serves the presets, roles and models", async () => {
      // Act
      const { catalog } = await read();

      // Assert
      expect(catalog.defaultPreset).toBe("standard");
      expect(catalog.presets.find((p) => p.id === "lean")?.models.implementer).toBe("sonnet");
      expect(catalog.roles).toEqual(["planner", "implementer", "reviewer", "runner", "explorer"]);
      expect(catalog.models).toEqual(["opus", "sonnet", "haiku", "fable"]);
    });

    it("reads a file with a BOM", async () => {
      // Arrange
      ctx.settings.write('\uFEFF{"env":{"SELO_COMMIT":"auto"}}');

      // Act
      const settings = await read();

      // Assert
      expect(settings.values.SELO_COMMIT).toBe("auto");
    });

    it("returns an invalid JSON file as unreadable, with the line and column of the error", async () => {
      // Arrange
      ctx.settings.write('{\n  "model": "opus",\n}');

      // Act
      const settings = await read();

      // Assert
      expect(settings.state).toBe("unreadable");
      expect(settings.error).toEqual({ reason: "json", line: 3, column: 1 });
    });

    it("returns a file whose root is not an object as unreadable", async () => {
      // Arrange
      ctx.settings.write("[]");

      // Act
      const settings = await read();

      // Assert
      expect(settings).toMatchObject({ state: "unreadable", error: { reason: "root" } });
    });

    it("returns a file whose env is not an object as unreadable", async () => {
      // Arrange
      ctx.settings.write('{"env":"SELO_ROUTING=on"}');

      // Act
      const settings = await read();

      // Assert
      expect(settings).toMatchObject({ state: "unreadable", error: { reason: "env" } });
    });
  });

  describe("PATCH /v1/settings", () => {
    it("creates a missing file", async () => {
      // Act
      const res = await save({ SELO_ROUTING: "on" });

      // Assert
      expect(res.status).toBe(200);
      expect(settingsSchema.parse(res.body)).toMatchObject({ state: "ok", values: { SELO_ROUTING: "on" } });
      expect(fileJson()).toEqual({ env: { SELO_ROUTING: "on" } });
    });

    it("keeps every other key of the file and of env, in their order", async () => {
      // Arrange
      ctx.settings.write(JSON.stringify({ model: "opus", env: { A: "1", SELO_MODELS: "lean", B: "2" }, permissions: { allow: ["Bash"] } }));

      // Act
      const res = await save({ SELO_MODEL_REVIEWER: "fable" });

      // Assert
      expect(res.status).toBe(200);
      const file = fileJson();
      expect(file).toEqual({ model: "opus", env: { A: "1", SELO_MODELS: "lean", B: "2", SELO_MODEL_REVIEWER: "fable" }, permissions: { allow: ["Bash"] } });
      expect(Object.keys(file)).toEqual(["model", "env", "permissions"]);
      expect(Object.keys(file.env as object)).toEqual(["A", "SELO_MODELS", "B", "SELO_MODEL_REVIEWER"]);
      expect(ctx.settings.read()).toContain('\n  "model": "opus",\n');
    });

    it("removes the key of a setting brought back to its default", async () => {
      // Arrange
      ctx.settings.write(JSON.stringify({ env: { SELO_MODELS: "lean", SELO_ROUTING: "on", SELO_COMMIT: "auto", SELO_MODEL_RUNNER: "sonnet" } }));

      // Act
      const res = await save({ SELO_MODELS: null, SELO_ROUTING: null, SELO_COMMIT: null, SELO_MODEL_RUNNER: null });

      // Assert
      expect(res.status).toBe(200);
      expect(fileJson()).toEqual({ env: {} });
    });

    it("keeps a role pinned to its preset's model", async () => {
      // Act
      await save({ SELO_MODEL_PLANNER: "opus" });

      // Assert
      expect(fileJson()).toEqual({ env: { SELO_MODEL_PLANNER: "opus" } });
    });

    it("leaves an unknown value when its setting is not changed", async () => {
      // Arrange
      ctx.settings.write(JSON.stringify({ env: { SELO_MODELS: "turbo", SELO_MODEL_EXPLORER: "gpt" } }));

      // Act
      await save({ SELO_COMMIT: "auto" });

      // Assert
      expect(fileJson()).toEqual({ env: { SELO_MODELS: "turbo", SELO_MODEL_EXPLORER: "gpt", SELO_COMMIT: "auto" } });
    });

    it("keeps a key written to the file after it was read", async () => {
      // Arrange
      ctx.settings.write(JSON.stringify({ env: {} }));
      await read();
      ctx.settings.write(JSON.stringify({ theme: "dark", env: { SELO_COMMIT: "auto" } }));

      // Act
      await save({ SELO_ROUTING: "on" });

      // Assert
      expect(fileJson()).toEqual({ theme: "dark", env: { SELO_COMMIT: "auto", SELO_ROUTING: "on" } });
    });

    it("returns 409 and writes nothing when the file is unreadable", async () => {
      // Arrange
      ctx.settings.write("{ broken");

      // Act
      const res = await save({ SELO_ROUTING: "on" });

      // Assert
      expect(res.status).toBe(409);
      expect((res.body as ProblemDetails).code).toBe("settings_unreadable");
      expect(ctx.settings.read()).toBe("{ broken");
    });

    it.each([
      ["whose root is not an object", "[]"],
      ["whose env is not an object", '{"env":[]}'],
    ])("returns 409 and writes nothing for a file %s", async (_case, content) => {
      // Arrange
      ctx.settings.write(content);

      // Act
      const res = await save({ SELO_ROUTING: "on" });

      // Assert
      expect(res.status).toBe(409);
      expect(ctx.settings.read()).toBe(content);
    });

    it("writes nothing when the file already holds the changes", async () => {
      // Arrange
      const content = '{"env":{"SELO_ROUTING":"on"},  "model":"opus"}';
      ctx.settings.write(content);

      // Act
      const res = await save({ SELO_ROUTING: "on", SELO_COMMIT: null });

      // Assert
      expect(res.status).toBe(200);
      expect(ctx.settings.read()).toBe(content);
    });

    it("writes the file back without its BOM", async () => {
      // Arrange
      ctx.settings.write('\uFEFF{"env":{}}');

      // Act
      await save({ SELO_COMMIT: "auto" });

      // Assert
      expect(ctx.settings.read()?.startsWith("{")).toBe(true);
    });

    it("returns 500 with the OS error when the file cannot be read", async () => {
      // Arrange
      mkdirSync(ctx.settings.file);

      // Act
      const res = await save({ SELO_COMMIT: "auto" });
      rmSync(ctx.settings.file, { recursive: true });

      // Assert
      expect(res.status).toBe(500);
      expect((res.body as ProblemDetails).code).toBe("settings_read_failed");
    });

    it.each([
      ["an unknown key", { SELO_OTHER: "x" }],
      ["a model not offered", { SELO_MODEL_RUNNER: "gpt" }],
      ["an unknown preset", { SELO_MODELS: "turbo" }],
      ["a default value", { SELO_MODELS: "standard" }],
      ["routing set to off", { SELO_ROUTING: "off" }],
      ["commit set to ask", { SELO_COMMIT: "ask" }],
    ])("returns 400 and writes nothing for %s", async (_case, body) => {
      // Arrange
      ctx.settings.write('{"env":{}}');

      // Act
      const res = await save(body);

      // Assert
      expect(res.status).toBe(400);
      expect(ctx.settings.read()).toBe('{"env":{}}');
    });
  });
});
