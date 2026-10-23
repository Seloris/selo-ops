import { Router } from "express";
import { inputOf, validate } from "../../shared/validate.js";
import { projectFileQuerySchema, projectParamsSchema } from "./projects.schema.js";
import type { ProjectService } from "./projects.service.js";

const file = { params: projectParamsSchema, query: projectFileQuerySchema };

// Public, like the whole application (see app.ts).
export function projectsRoutes({ projects }: { projects: ProjectService }): Router {
  const router = Router();
  router.get("/v1/projects", (_req, res) => {
    res.json(projects.list());
  });
  router.get("/v1/projects/:id/file", validate(file), (_req, res) => {
    const { params, query } = inputOf<typeof file>(res);
    res.json(projects.readFile(params.id, query.path));
  });
  return router;
}
