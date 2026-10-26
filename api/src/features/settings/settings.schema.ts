import { z } from "zod";
import { problemDetailsSchema } from "../../shared/errors.js";
import { registry } from "../../shared/openapi.js";

// Copied from the selo plugin's scripts/manifest.mjs (PRESETS, ROLES): keep in step with it (`settings` BR-02).
export const PRESETS = {
  standard: { planner: "opus", implementer: "opus", reviewer: "opus", runner: "haiku", explorer: "haiku" },
  lean: { planner: "opus", implementer: "sonnet", reviewer: "opus", runner: "haiku", explorer: "haiku" },
} as const;
export const DEFAULT_PRESET = "standard";
export const ROLES = ["planner", "implementer", "reviewer", "runner", "explorer"] as const;
export const MODELS = ["opus", "sonnet", "haiku", "fable"] as const;

// The `SELO_` keys of the `env` block Selo Ops shows and writes, in the order the window lists them.
export const SETTING_KEYS = [
  "SELO_MODELS",
  "SELO_MODEL_PLANNER",
  "SELO_MODEL_IMPLEMENTER",
  "SELO_MODEL_REVIEWER",
  "SELO_MODEL_RUNNER",
  "SELO_MODEL_EXPLORER",
  "SELO_ROUTING",
  "SELO_COMMIT",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

const roleSchema = z.enum(ROLES);
const modelSchema = z.enum(MODELS);

// As the file holds them: null when absent, a value Selo Ops does not know kept as is.
const valueSchema = z.string().nullable();
export const settingValuesSchema = z
  .object({
    SELO_MODELS: valueSchema,
    SELO_MODEL_PLANNER: valueSchema,
    SELO_MODEL_IMPLEMENTER: valueSchema,
    SELO_MODEL_REVIEWER: valueSchema,
    SELO_MODEL_RUNNER: valueSchema,
    SELO_MODEL_EXPLORER: valueSchema,
    SELO_ROUTING: valueSchema,
    SELO_COMMIT: valueSchema,
  })
  .meta({ id: "SeloSettingValues" });

export const settingsSchema = z
  .object({
    path: z.string(),
    // `settings` BR-04: a missing file reads as the defaults; an unreadable one is never written.
    state: z.enum(["ok", "missing", "unreadable"]),
    // Why the file is unreadable: not JSON, a root or an `env` that is not an object; line and column for the first, when known.
    error: z.object({ reason: z.enum(["json", "root", "env"]), line: z.number().int().nullable(), column: z.number().int().nullable() }).nullable(),
    values: settingValuesSchema,
    catalog: z.object({
      defaultPreset: z.string(),
      presets: z.array(z.object({ id: z.string(), models: z.record(roleSchema, modelSchema) })),
      roles: z.array(roleSchema),
      models: z.array(modelSchema),
    }),
  })
  .meta({ id: "SeloSettings" });

// `settings` BR-03: only the changed keys; null removes a key, which a setting brought back to its default does.
// A default value itself (`standard`, off, ask) is never written, so it is not accepted.
const change = <T extends z.ZodType>(schema: T) => schema.nullable().optional();
export const settingChangesSchema = z
  .strictObject({
    SELO_MODELS: change(z.enum(["standard", "lean"]).exclude([DEFAULT_PRESET])),
    SELO_MODEL_PLANNER: change(modelSchema),
    SELO_MODEL_IMPLEMENTER: change(modelSchema),
    SELO_MODEL_REVIEWER: change(modelSchema),
    SELO_MODEL_RUNNER: change(modelSchema),
    SELO_MODEL_EXPLORER: change(modelSchema),
    SELO_ROUTING: change(z.literal("on")),
    SELO_COMMIT: change(z.literal("auto")),
  })
  .meta({ id: "SeloSettingChanges" });

export type SeloSettings = z.infer<typeof settingsSchema>;
export type SettingValues = z.infer<typeof settingValuesSchema>;
export type SettingChanges = z.infer<typeof settingChangesSchema>;

const problem = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: problemDetailsSchema } },
});
const settingsResponse = { description: "The settings, as the file holds them", content: { "application/json": { schema: settingsSchema } } };

registry.registerPath({
  method: "get",
  path: "/v1/settings",
  summary: "The person's selo settings: the SELO_ keys of the env block of Claude Code's user settings file",
  responses: { 200: settingsResponse },
});

registry.registerPath({
  method: "patch",
  path: "/v1/settings",
  summary: "Save the changed settings: the file read again, only these keys of its env block written",
  request: { body: { content: { "application/json": { schema: settingChangesSchema } } } },
  responses: {
    200: settingsResponse,
    400: problem("An unknown key, or a value not allowed"),
    409: problem("The file is unreadable: nothing written"),
    500: problem("The file could not be written"),
  },
});
