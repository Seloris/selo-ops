import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { migrateDatabase, openDatabase } from "./db/client.js";
import { systemClock } from "./shared/clock.js";

const config = readConfig();
const db = openDatabase(config.PGLITE_DIR);
await migrateDatabase(db);
createApp({
  db,
  clock: systemClock,
  opsDir: config.opsDir,
  claudeSessionsDir: config.claudeSessionsDir,
  claudeProjectsDir: config.claudeProjectsDir,
  claudePluginsFile: config.claudePluginsFile,
  claudeSettingsFile: config.claudeSettingsFile,
}).listen(config.PORT, config.API_HOST, () => {
  console.log(`api listening on http://${config.API_HOST}:${config.PORT}, reading ${config.opsDir}`);
});
