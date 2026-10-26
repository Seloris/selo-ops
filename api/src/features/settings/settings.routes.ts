import { Router } from "express";
import { inputOf, validate } from "../../shared/validate.js";
import { settingChangesSchema } from "./settings.schema.js";
import type { SettingsService } from "./settings.service.js";

const save = { body: settingChangesSchema };

// Public, like the whole application (see app.ts).
export function settingsRoutes({ settings }: { settings: SettingsService }): Router {
  const router = Router();
  router.get("/v1/settings", (_req, res) => {
    res.json(settings.read());
  });
  router.patch("/v1/settings", validate(save), (_req, res) => {
    res.json(settings.save(inputOf<typeof save>(res).body));
  });
  return router;
}
