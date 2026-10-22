import { Router } from "express";
import { inputOf, validate } from "../../shared/validate.js";
import { sessionParamsSchema } from "./sessions.schema.js";
import type { SessionService } from "./sessions.service.js";

const byId = { params: sessionParamsSchema };

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
  return router;
}
