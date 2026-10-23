import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sessionNotes } from "../../src/features/sessions/sessions.table.js";
import { sessionsResponseSchema, type Session } from "../../src/features/sessions/sessions.schema.js";
import type { ProblemDetails } from "../../src/shared/errors.js";
import { buildRun, buildRunningStatusFile, buildSessionFile, transcriptFolderOf } from "../factories.js";
import { createTestContext } from "../setup.js";

describe("session note routes", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const only = async (): Promise<Session> => {
    const res = await request(ctx.app).get("/v1/sessions");
    const { sessions } = sessionsResponseSchema.parse(res.body);
    expect(sessions).toHaveLength(1);
    return sessions[0];
  };
  const putNote = (id: string, body: unknown) => request(ctx.app).put(`/v1/sessions/${id}/note`).send(body as object);

  it("gives no note to a session that has none", async () => {
    // Arrange
    ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ phase: "working" }) }));

    // Act
    const session = await only();

    // Assert
    expect(session.note).toBeNull();
  });

  it("saves a note, trimmed, and gives it on the session", async () => {
    // Arrange
    ctx.clock.set("2026-03-01T08:00:00.000Z");
    ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ phase: "working" }) }));

    // Act
    const res = await putNote("s1", { text: "  Relancer les tests après le merge  " });

    // Assert
    expect(res.status).toBe(204);
    expect(await ctx.db.select().from(sessionNotes)).toEqual([
      { sessionId: "s1", text: "Relancer les tests après le merge", updatedAt: new Date("2026-03-01T08:00:00.000Z") },
    ]);
    expect((await only()).note).toBe("Relancer les tests après le merge");
  });

  it("replaces the note of a session", async () => {
    // Arrange
    ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ phase: "working" }) }));
    await putNote("s1", { text: "first" }).expect(204);

    // Act
    await putNote("s1", { text: "second" }).expect(204);

    // Assert
    expect(await ctx.db.select().from(sessionNotes)).toHaveLength(1);
    expect((await only()).note).toBe("second");
  });

  it.each([[""], ["   "]])("removes the note when the text is %j", async (text) => {
    // Arrange
    ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ phase: "working" }) }));
    await putNote("s1", { text: "a note" }).expect(204);

    // Act
    const res = await putNote("s1", { text });

    // Assert
    expect(res.status).toBe(204);
    expect(await ctx.db.select().from(sessionNotes)).toEqual([]);
    expect((await only()).note).toBeNull();
  });

  it("keeps the note when a new run of the session starts", async () => {
    // Arrange
    ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ id: "s1:1", phase: "job-done" }) }));
    await putNote("s1", { text: "for later" }).expect(204);
    ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ id: "s1:2", phase: "working" }) }));

    // Act
    const session = await only();

    // Assert
    expect(session.note).toBe("for later");
  });

  it("accepts 200 characters and refuses 201", async () => {
    // Arrange
    ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ phase: "working" }) }));

    // Act
    const ok = await putNote("s1", { text: "a".repeat(200) });
    const tooLong = await putNote("s1", { text: "b".repeat(201) });

    // Assert
    expect(ok.status).toBe(204);
    expect(tooLong.status).toBe(400);
    expect((await only()).note).toBe("a".repeat(200));
  });

  it("returns 400 when the body has no text", async () => {
    // Arrange
    ctx.seed.session(buildSessionFile({ sessionId: "s1", current: buildRun({ phase: "working" }) }));

    // Act
    const res = await putNote("s1", {});

    // Assert
    expect(res.status).toBe(400);
  });

  it("saves a note on a running session outside selo", async () => {
    // Arrange
    const cwd = ctx.code.folder("scratch");
    const status = buildRunningStatusFile({ cwd });
    ctx.seed.running(status);
    ctx.seed.transcript(transcriptFolderOf(cwd), status.sessionId, [{ type: "user", uuid: "u-1", message: { role: "user", content: "Fix the build" } }]);

    // Act
    const res = await putNote(status.sessionId, { text: "check CI" });

    // Assert
    expect(res.status).toBe(204);
    expect(await only()).toMatchObject({ isOutsideSelo: true, note: "check CI" });
  });

  it("returns 404 when the session is not in the export", async () => {
    // Act
    const res = await putNote("missing", { text: "x" });

    // Assert
    expect(res.status).toBe(404);
    expect((res.body as ProblemDetails).code).toBe("not_found");
    expect(await ctx.db.select().from(sessionNotes)).toEqual([]);
  });
});
