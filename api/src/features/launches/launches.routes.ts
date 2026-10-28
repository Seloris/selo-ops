import { Router } from "express";
import { inputOf, validate } from "../../shared/validate.js";
import { launchParamsSchema, launchSessionSchema } from "./launches.schema.js";
import type { LaunchService } from "./launches.service.js";

const launchInput = { params: launchParamsSchema, body: launchSessionSchema };

// Public, like the whole application (see app.ts).
export function launchesRoutes({ launches }: { launches: LaunchService }): Router {
  const router = Router();
  router.post("/v1/projects/:id/sessions", validate(launchInput), async (_req, res) => {
    const { params, body } = inputOf<typeof launchInput>(res);
    res.status(201).json(await launches.launch(params.id, body));
  });
  return router;
}
