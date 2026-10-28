import { eq } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { appSettings } from "./settings.table.js";

const CLI_LAUNCH = "cliLaunch";

// `settings` BR-05: Selo Ops' own settings, in its database.
export interface AppSettingsRepository {
  // Off while never set.
  isCliLaunch(): Promise<boolean>;
  setCliLaunch(isOn: boolean): Promise<void>;
}

export function createAppSettingsRepository(db: Database): AppSettingsRepository {
  return {
    isCliLaunch: async () => {
      const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, CLI_LAUNCH));
      return row?.value === true;
    },
    setCliLaunch: async (isOn) => {
      await db.insert(appSettings).values({ key: CLI_LAUNCH, value: isOn }).onConflictDoUpdate({ target: appSettings.key, set: { value: isOn } });
    },
  };
}
