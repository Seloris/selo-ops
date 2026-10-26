import { AppError, ConflictError } from "../../shared/errors.js";
import type { SettingsFile, SettingsRead } from "./settings.file.js";
import {
  DEFAULT_PRESET,
  MODELS,
  PRESETS,
  ROLES,
  SETTING_KEYS,
  type SeloSettings,
  type SettingChanges,
  type SettingValues,
} from "./settings.schema.js";

const CATALOG: SeloSettings["catalog"] = {
  defaultPreset: DEFAULT_PRESET,
  presets: Object.entries(PRESETS).map(([id, models]) => ({ id, models })),
  roles: [...ROLES],
  models: [...MODELS],
};

export interface SettingsService {
  read(): SeloSettings;
  save(changes: SettingChanges): SeloSettings;
}

export function createSettingsService({ file }: { file: SettingsFile }): SettingsService {
  const toSettings = (read: SettingsRead): SeloSettings => {
    const env = read.state === "ok" ? (read.root.env as Record<string, unknown> | undefined) : undefined;
    // `settings` BR-02: as the file holds them, a value of another type shown as JSON.
    const valueOf = (v: unknown) => (v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v));
    const values = Object.fromEntries(SETTING_KEYS.map((key) => [key, valueOf(env?.[key])])) as SettingValues;
    return { path: file.path, state: read.state, error: read.state === "unreadable" ? read.error : null, values, catalog: CATALOG };
  };

  return {
    read: () => toSettings(file.read()),
    // `settings` BR-03 and BR-04: the file read again, only the changed keys of `env` touched, the rest left as it is.
    save: (changes) => {
      const current = file.read();
      if (current.state === "unreadable") throw new ConflictError("settings_unreadable", "The settings file is unreadable: fix it, then read it again");
      const changed = Object.entries(changes).filter(([, v]) => v !== undefined);
      if (changed.length === 0) return toSettings(current);
      const root = current.state === "ok" ? current.root : {};
      // Spread keeps each key's place: a changed key stays where it was, a new one goes last.
      const env: Record<string, unknown> = { ...(root.env as Record<string, unknown> | undefined) };
      for (const [key, value] of changed) {
        if (value === null) delete env[key];
        else env[key] = value;
      }
      try {
        file.write({ ...root, env });
      } catch (err) {
        throw new AppError(500, "settings_write_failed", `The settings file could not be written: ${err instanceof Error ? err.message : String(err)}`);
      }
      return toSettings(file.read());
    },
  };
}
