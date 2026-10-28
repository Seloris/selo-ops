import type { components } from "../../../api/schema.d.ts";

export type SeloSettings = components["schemas"]["SeloSettings"];
export type SettingValues = SeloSettings["values"];
export type SettingChanges = components["schemas"]["SeloSettingChanges"];
export type SettingKey = keyof SettingValues;
export type Catalog = SeloSettings["catalog"];
export type Role = Catalog["roles"][number];

export type SeloOpsSettings = SeloSettings["seloOps"];

// The window's choices: the preset, each role's model ("" follows the preset), the two switches, then Selo Ops' own.
export interface SettingsChoices {
  preset: string;
  roles: Record<Role, string>;
  isRouting: boolean;
  isAutoCommit: boolean;
  // app FR-13: « Lancer les sessions en CLI » (`settings` BR-05).
  isCliLaunch: boolean;
}

export const roleKey = (role: Role) => `SELO_MODEL_${role.toUpperCase()}` as SettingKey;

// As the selo plugin reads a value: trimmed, empty as absent.
const set = (v: string | null) => (v !== null && v.trim() !== "" ? v.trim() : null);

// `settings` BR-02: an unknown preset reads as the default one.
export function presetOf(value: string | null, catalog: Catalog): string {
  const preset = set(value);
  return preset !== null && catalog.presets.some((p) => p.id === preset) ? preset : catalog.defaultPreset;
}

export function choicesOf(values: SettingValues, catalog: Catalog, seloOps: SeloOpsSettings): SettingsChoices {
  return {
    preset: presetOf(values.SELO_MODELS, catalog),
    roles: Object.fromEntries(catalog.roles.map((role) => [role, set(values[roleKey(role)]) ?? ""])) as Record<Role, string>,
    isRouting: values.SELO_ROUTING === "on",
    isAutoCommit: values.SELO_COMMIT === "auto",
    isCliLaunch: seloOps.cliLaunch,
  };
}

// sessions-live FR-60: off until the settings are read and say it is on.
export const isCliLaunchOn = (settings: SeloSettings | undefined) => settings?.seloOps.cliLaunch === true;

// The model a preset gives a role.
export function presetModel(preset: string, role: Role, catalog: Catalog): string {
  const models = catalog.presets.find((p) => p.id === preset) ?? catalog.presets.find((p) => p.id === catalog.defaultPreset);
  return models?.models[role] ?? "";
}

// app FR-09: a role set by hand is « personnalisé », whatever its model, even its preset's one.
export function roleModel(choices: SettingsChoices, role: Role, catalog: Catalog): { model: string; isCustom: boolean } {
  const pinned = choices.roles[role];
  return pinned !== "" ? { model: pinned, isCustom: true } : { model: presetModel(choices.preset, role, catalog), isCustom: false };
}

// `settings` BR-03: only the settings whose choice moved; a default choice removes its key (null).
export function changesOf(initial: SettingsChoices, current: SettingsChoices, catalog: Catalog): SettingChanges {
  const changes: Record<string, string | null | SettingChanges["seloOps"]> = {};
  if (current.preset !== initial.preset) changes.SELO_MODELS = current.preset === catalog.defaultPreset ? null : current.preset;
  for (const role of catalog.roles) {
    if (current.roles[role] !== initial.roles[role]) changes[roleKey(role)] = current.roles[role] === "" ? null : current.roles[role];
  }
  if (current.isRouting !== initial.isRouting) changes.SELO_ROUTING = current.isRouting ? "on" : null;
  if (current.isAutoCommit !== initial.isAutoCommit) changes.SELO_COMMIT = current.isAutoCommit ? "auto" : null;
  // `settings` BR-05: kept in Selo Ops' data, not in `env`.
  if (current.isCliLaunch !== initial.isCliLaunch) changes.seloOps = { cliLaunch: current.isCliLaunch };
  return changes as SettingChanges;
}

export type PreviewMark = "add" | "change" | "same";

// app FR-10: the SELO_ keys `env` will hold once saved, in the window's order; a key left out is not in the file.
export function previewOf(values: SettingValues, changes: SettingChanges): { key: SettingKey; value: string; mark: PreviewMark }[] {
  return (Object.keys(values) as SettingKey[]).flatMap((key) => {
    const before = values[key];
    const after = key in changes ? (changes[key] ?? null) : before;
    if (after === null) return [];
    return [{ key, value: after, mark: before === null ? "add" : before === after ? "same" : "change" }];
  });
}

// What a preset sets, from the catalog: its models, each with the roles it runs, in the roles' order.
export function presetSummary(preset: string, catalog: Catalog): { model: string; roles: Role[] }[] {
  const groups: { model: string; roles: Role[] }[] = [];
  for (const role of catalog.roles) {
    const model = presetModel(preset, role, catalog);
    const group = groups.find((g) => g.model === model);
    if (group) group.roles.push(role);
    else groups.push({ model, roles: [role] });
  }
  return groups;
}
