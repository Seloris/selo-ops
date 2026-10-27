import { Router } from "express";
import { inputOf, validate } from "../../shared/validate.js";
import { fileDiffQuerySchema, noteBodySchema, sessionParamsSchema } from "./sessions.schema.js";
import type { SessionService } from "./sessions.service.js";

const byId = { params: sessionParamsSchema };
const note = { params: sessionParamsSchema, body: noteBodySchema };
const diff = { params: sessionParamsSchema, query: fileDiffQuerySchema };

// Public, like the whole application (see app.ts).
export function sessionsRoutes({ sessions }: { sessions: SessionService }): Router {
  const router = Router();
  router.get("/v1/sessions", async (_req, res) => {
    res.json(await sessions.list());
  });
  router.put("/v1/sessions/:id/archive", validate(byId), async (_req, res) => {
    await sessions.archive(inputOf<typeof byId>(res).params.id);
    res.status(204).end();
  });
  router.delete("/v1/sessions/:id/archive", validate(byId), async (_req, res) => {
    await sessions.unarchive(inputOf<typeof byId>(res).params.id);
    res.status(204).end();
  });
  router.put("/v1/sessions/:id/note", validate(note), async (_req, res) => {
    const { params, body } = inputOf<typeof note>(res);
    await sessions.saveNote(params.id, body.text);
    res.status(204).end();
  });
  router.get("/v1/sessions/:id/trails", validate(byId), async (_req, res) => {
    res.json(await sessions.trails(inputOf<typeof byId>(res).params.id));
  });
  router.get("/v1/sessions/:id/files", validate(byId), async (_req, res) => {
    res.json(await sessions.fileSummary(inputOf<typeof byId>(res).params.id));
  });
  router.get("/v1/sessions/:id/diff", validate(diff), async (_req, res) => {
    const { params, query } = inputOf<typeof diff>(res);
    res.json(await sessions.fileDiff(params.id, query.file));
  });
  return router;
}
