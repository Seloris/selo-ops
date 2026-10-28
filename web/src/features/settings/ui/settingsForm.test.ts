import { describe, expect, it } from "vitest";
import { changesOf, choicesOf, isCliLaunchOn, presetSummary, previewOf, roleModel, type Catalog, type SeloSettings, type SettingValues } from "./settingsForm.ts";

const catalog: Catalog = {
  defaultPreset: "standard",
  presets: [
    { id: "standard", models: { planner: "opus", implementer: "opus", reviewer: "opus", runner: "haiku", explorer: "haiku" } },
    { id: "lean", models: { planner: "opus", implementer: "sonnet", reviewer: "opus", runner: "haiku", explorer: "haiku" } },
  ],
  roles: ["planner", "implementer", "reviewer", "runner", "explorer"],
  models: ["opus", "sonnet", "haiku", "fable"],
};

const empty: SettingValues = {
  SELO_MODELS: null,
  SELO_MODEL_PLANNER: null,
  SELO_MODEL_IMPLEMENTER: null,
  SELO_MODEL_REVIEWER: null,
  SELO_MODEL_RUNNER: null,
  SELO_MODEL_EXPLORER: null,
  SELO_ROUTING: null,
  SELO_COMMIT: null,
};

// `settings` BR-05: Selo Ops' own settings, off by default.
const off = { cliLaunch: false };

describe("roleModel", () => {
  it("follows the preset when the role is not set", () => {
    const choices = choicesOf({ ...empty, SELO_MODELS: "lean" }, catalog, off);
    expect(roleModel(choices, "implementer", catalog)).toEqual({ model: "sonnet", isCustom: false });
  });

  it("reads an unknown preset as the default one", () => {
    const choices = choicesOf({ ...empty, SELO_MODELS: "turbo" }, catalog, off);
    expect(choices.preset).toBe("standard");
    expect(roleModel(choices, "implementer", catalog).model).toBe("opus");
  });

  it("marks a role pinned to its preset's model as custom", () => {
    const choices = choicesOf({ ...empty, SELO_MODEL_PLANNER: "opus" }, catalog, off);
    expect(roleModel(choices, "planner", catalog)).toEqual({ model: "opus", isCustom: true });
  });

  it("keeps a model the menu does not offer as the role's choice", () => {
    const choices = choicesOf({ ...empty, SELO_MODEL_RUNNER: " gpt " }, catalog, off);
    expect(roleModel(choices, "runner", catalog)).toEqual({ model: "gpt", isCustom: true });
  });

  it("reads an empty value as not set", () => {
    const choices = choicesOf({ ...empty, SELO_MODEL_RUNNER: " " }, catalog, off);
    expect(roleModel(choices, "runner", catalog)).toEqual({ model: "haiku", isCustom: false });
  });
});

describe("changesOf", () => {
  it("has no change while nothing moved", () => {
    const initial = choicesOf({ ...empty, SELO_MODELS: "turbo", SELO_ROUTING: "ON" }, catalog, off);
    expect(changesOf(initial, { ...initial }, catalog)).toEqual({});
  });

  it("writes what moved and removes what came back to its default", () => {
    const initial = choicesOf({ ...empty, SELO_COMMIT: "auto", SELO_MODEL_RUNNER: "sonnet" }, catalog, off);
    const current = { ...initial, preset: "lean", isRouting: true, isAutoCommit: false, roles: { ...initial.roles, reviewer: "fable", runner: "" } };
    expect(changesOf(initial, current, catalog)).toEqual({
      SELO_MODELS: "lean",
      SELO_MODEL_REVIEWER: "fable",
      SELO_MODEL_RUNNER: null,
      SELO_ROUTING: "on",
      SELO_COMMIT: null,
    });
  });

  it("removes the preset's key when it is set back to the default", () => {
    const initial = choicesOf({ ...empty, SELO_MODELS: "lean" }, catalog, off);
    expect(changesOf(initial, { ...initial, preset: "standard" }, catalog)).toEqual({ SELO_MODELS: null });
  });

  it("saves « Lancer les sessions en CLI » apart from the SELO_ keys (app FR-13)", () => {
    const initial = choicesOf(empty, catalog, off);
    expect(initial.isCliLaunch).toBe(false);
    expect(changesOf(initial, { ...initial, isCliLaunch: true }, catalog)).toEqual({ seloOps: { cliLaunch: true } });
    const on = choicesOf(empty, catalog, { cliLaunch: true });
    expect(changesOf(on, { ...on, isCliLaunch: false }, catalog)).toEqual({ seloOps: { cliLaunch: false } });
  });

  it("counts a setting moved and moved back as no change", () => {
    const initial = choicesOf({ ...empty, SELO_MODELS: "turbo" }, catalog, off);
    const moved = { ...initial, preset: "lean" };
    expect(changesOf(initial, { ...moved, preset: "standard" }, catalog)).toEqual({});
  });
});

describe("presetSummary", () => {
  it("groups a preset's roles by model, in the roles' order", () => {
    expect(presetSummary("lean", catalog)).toEqual([
      { model: "opus", roles: ["planner", "reviewer"] },
      { model: "sonnet", roles: ["implementer"] },
      { model: "haiku", roles: ["runner", "explorer"] },
    ]);
  });
});

describe("previewOf", () => {
  it("lists the keys env will hold, each marked new, changed or kept", () => {
    const values = { ...empty, SELO_MODELS: "lean", SELO_COMMIT: "auto", SELO_MODEL_EXPLORER: "gpt" };
    const preview = previewOf(values, { SELO_MODELS: null, SELO_MODEL_REVIEWER: "fable", SELO_COMMIT: "auto", SELO_ROUTING: "on" });
    expect(preview).toEqual([
      { key: "SELO_MODEL_REVIEWER", value: "fable", mark: "add" },
      { key: "SELO_MODEL_EXPLORER", value: "gpt", mark: "same" },
      { key: "SELO_ROUTING", value: "on", mark: "add" },
      { key: "SELO_COMMIT", value: "auto", mark: "same" },
    ]);
  });

  it("marks a value replaced as changed", () => {
    expect(previewOf({ ...empty, SELO_MODEL_RUNNER: "sonnet" }, { SELO_MODEL_RUNNER: "opus" })).toEqual([{ key: "SELO_MODEL_RUNNER", value: "opus", mark: "change" }]);
  });
});

describe("isCliLaunchOn (sessions-live FR-60)", () => {
  const settings = (cliLaunch: boolean) => ({ seloOps: { cliLaunch } }) as SeloSettings;

  it("is on only once the settings say so", () => {
    expect(isCliLaunchOn(settings(true))).toBe(true);
    expect(isCliLaunchOn(settings(false))).toBe(false);
  });

  it("is off while the settings are not read", () => {
    expect(isCliLaunchOn(undefined)).toBe(false);
  });
});
