import { Router } from "express";
import { inputOf, validate } from "../../shared/validate.js";
import { statsQuerySchema } from "./stats.schema.js";
import type { StatsService } from "./stats.service.js";

const read = { query: statsQuerySchema };

// Public, like the whole application (see app.ts).
export function statsRoutes({ stats }: { stats: StatsService }): Router {
  const router = Router();
  router.get("/v1/stats", validate(read), async (_req, res) => {
    res.json(await stats.read(inputOf<typeof read>(res).query));
  });
  return router;
}
