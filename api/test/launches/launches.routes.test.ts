import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LaunchError } from "../../src/features/launches/launches.launcher.js";
import { launchedSessionSchema } from "../../src/features/launches/launches.schema.js";
import type { ProblemDetails } from "../../src/shared/errors.js";
import { buildProjectFile, rootKeyOf } from "../factories.js";
import { createTestContext } from "../setup.js";

// `session` BR-24: a session started in the background from the launch recap (a fake launcher here, never `claude`).

const slash = (path: string) => path.replace(/\\/g, "/");

describe("POST /v1/projects/:id/sessions", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const seedProject = () => {
    const root = slash(ctx.code.repo("ledger-api"));
    ctx.seed.project(buildProjectFile({ root }));
    return { root, id: rootKeyOf(root) };
  };
  const turnCliOn = async () => {
    const res = await request(ctx.app).patch("/v1/settings").send({ seloOps: { cliLaunch: true } });
    expect(res.status).toBe(200);
  };
  const launch = (id: string, body: object) => request(ctx.app).post(`/v1/projects/${id}/sessions`).send(body);
  const body = (folder: string, overrides: object = {}) => ({
    folder,
    command: "/selo-flow:pilot Ajoute un tag",
    title: "Ajoute un tag",
    isAutoMode: false,
    ...overrides,
  });

  it("starts the session in the project's checkout, named after the project and the request", async () => {
    // Arrange
    const { root, id } = seedProject();
    await turnCliOn();

    // Act
    const res = await launch(id, body(root));

    // Assert
    expect(res.status).toBe(201);
    expect(launchedSessionSchema.parse(res.body)).toEqual({ id: "bg-1234", name: "ledger-api · Ajoute un tag", folder: root });
    expect(ctx.launches).toEqual([{ cwd: root, name: "ledger-api · Ajoute un tag", command: "/selo-flow:pilot Ajoute un tag", isAutoMode: false }]);
  });

  it("passes « Mode auto » on", async () => {
    // Arrange
    const { root, id } = seedProject();
    await turnCliOn();

    // Act
    const res = await launch(id, body(root, { isAutoMode: true }));

    // Assert
    expect(res.status).toBe(201);
    expect(ctx.launches[0]?.isAutoMode).toBe(true);
  });

  it("starts the session in a worktree of the project, as the export spells its folder", async () => {
    // Arrange
    const { root, id } = seedProject();
    const worktree = slash(ctx.code.folder("ledger-api-wt"));
    ctx.seed.project(buildProjectFile({ root: worktree, repo: `${root}/.git`, branch: "claude/tags" }));
    await turnCliOn();

    // Act
    const res = await launch(id, body(worktree.toUpperCase().replace(/\//g, "\\")));

    // Assert
    expect(res.status).toBe(201);
    expect(ctx.launches[0]?.cwd).toBe(worktree);
  });

  it("returns 409 and starts nothing while the CLI mode is off", async () => {
    // Arrange
    const { root, id } = seedProject();

    // Act
    const res = await launch(id, body(root));

    // Assert
    expect(res.status).toBe(409);
    expect((res.body as ProblemDetails).code).toBe("cli_launch_off");
    expect(ctx.launches).toHaveLength(0);
  });

  it("returns 400 and starts nothing in a folder that is no checkout nor worktree of the project", async () => {
    // Arrange
    const { id } = seedProject();
    const other = slash(ctx.code.repo("elsewhere"));
    await turnCliOn();

    // Act
    const res = await launch(id, body(other));

    // Assert
    expect(res.status).toBe(400);
    expect((res.body as ProblemDetails).errors).toHaveProperty("body.folder");
    expect(ctx.launches).toHaveLength(0);
  });

  it("returns 400 for a command starting with a dash", async () => {
    // Arrange
    const { root, id } = seedProject();
    await turnCliOn();

    // Act
    const res = await launch(id, body(root, { command: "--dangerously-skip-permissions" }));

    // Assert
    expect(res.status).toBe(400);
    expect(ctx.launches).toHaveLength(0);
  });

  it("returns 404 for an unknown project", async () => {
    // Arrange
    await turnCliOn();

    // Act
    const res = await launch("nope", body("C:/code/nope"));

    // Assert
    expect(res.status).toBe(404);
  });

  it("returns 502 claude_not_found when Claude Code is missing", async () => {
    // Arrange
    const { root, id } = seedProject();
    await turnCliOn();
    ctx.answerLaunch(() => Promise.reject(new LaunchError("missing-binary", "spawn claude ENOENT")));

    // Act
    const res = await launch(id, body(root));

    // Assert
    expect(res.status).toBe(502);
    expect((res.body as ProblemDetails).code).toBe("claude_not_found");
  });

  it("returns 502 launch_failed with Claude Code's error when the start fails", async () => {
    // Arrange
    const { root, id } = seedProject();
    await turnCliOn();
    ctx.answerLaunch(() => Promise.reject(new LaunchError("launch-failed", "Not logged in")));

    // Act
    const res = await launch(id, body(root));

    // Assert
    expect(res.status).toBe(502);
    expect((res.body as ProblemDetails).code).toBe("launch_failed");
    expect((res.body as ProblemDetails).detail).toContain("Not logged in");
  });
});
