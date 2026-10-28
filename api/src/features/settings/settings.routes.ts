import { Router } from "express";
import { inputOf, validate } from "../../shared/validate.js";
import { settingChangesSchema } from "./settings.schema.js";
import type { SettingsService } from "./settings.service.js";

const save = { body: settingChangesSchema };

// Public, like the whole application (see app.ts).
export function settingsRoutes({ settings }: { settings: SettingsService }): Router {
  const router = Router();
  router.get("/v1/settings", async (_req, res) => {
    res.json(await settings.read());
  });
  router.patch("/v1/settings", validate(save), async (_req, res) => {
    res.json(await settings.save(inputOf<typeof save>(res).body));
  });
  return router;
}
