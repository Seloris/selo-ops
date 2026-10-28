import { AppError, ConflictError } from "../../shared/errors.js";
import type { SettingsFile, SettingsRead } from "./settings.file.js";
import type { AppSettingsRepository } from "./settings.repository.js";
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
  read(): Promise<SeloSettings>;
  save(changes: SettingChanges): Promise<SeloSettings>;
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function createSettingsService({ file, appSettings }: { file: SettingsFile; appSettings: AppSettingsRepository }): SettingsService {
  // A file that cannot be read at all (rights, a folder): its OS error, not a bare 500.
  const readFile = () => {
    try {
      return file.read();
    } catch (err) {
      throw new AppError(500, "settings_read_failed", `The settings file could not be read: ${messageOf(err)}`);
    }
  };
  const toSettings = async (read: SettingsRead): Promise<SeloSettings> => {
    const env = read.state === "ok" ? (read.root.env as Record<string, unknown> | undefined) : undefined;
    // `settings` BR-02: as the file holds them, a value of another type shown as JSON.
    const valueOf = (v: unknown) => (v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v));
    const values = Object.fromEntries(SETTING_KEYS.map((key) => [key, valueOf(env?.[key])])) as SettingValues;
    const seloOps = { cliLaunch: await appSettings.isCliLaunch() };
    return { path: file.path, state: read.state, error: read.state === "unreadable" ? read.error : null, values, catalog: CATALOG, seloOps };
  };

  // `settings` BR-03 and BR-04: the file read again, only the changed keys of `env` touched, the rest left as it is.
  const saveFile = (changes: Omit<SettingChanges, "seloOps">): SettingsRead => {
    const current = readFile();
    // No SELO_ key changed: the file is not even checked, so that Selo Ops' own settings save beside an unreadable one.
    if (Object.values(changes).every((v) => v === undefined)) return current;
    if (current.state === "unreadable") throw new ConflictError("settings_unreadable", "The settings file is unreadable: fix it, then read it again");
    const root = current.state === "ok" ? current.root : {};
    // Spread keeps each key's place: a changed key stays where it was, a new one goes last.
    const env: Record<string, unknown> = { ...(root.env as Record<string, unknown> | undefined) };
    // What the file already holds is no change: nothing to write, not even a re-indented file.
    const changed = Object.entries(changes).filter(([key, v]) => v !== undefined && v !== (env[key] ?? null));
    if (changed.length === 0) return current;
    for (const [key, value] of changed) {
      if (value === null) delete env[key];
      else env[key] = value;
    }
    try {
      file.write({ ...root, env });
    } catch (err) {
      throw new AppError(500, "settings_write_failed", `The settings file could not be written: ${messageOf(err)}`);
    }
    return readFile();
  };

  return {
    read: () => toSettings(readFile()),
    // `settings` BR-05: Selo Ops' own settings once the file is written, so that a failed write saves nothing.
    save: async ({ seloOps, ...changes }) => {
      const read = saveFile(changes);
      if (seloOps?.cliLaunch !== undefined) await appSettings.setCliLaunch(seloOps.cliLaunch);
      return toSettings(read);
    },
  };
}
