import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { migrateDatabase, openDatabase } from "./db/client.js";
import { createQuestionRepository } from "./features/questions/questions.repository.js";
import { createClaudeLauncher } from "./features/launches/launches.launcher.js";
import { createClaudeRunner } from "./features/questions/questions.runner.js";
import { systemClock } from "./shared/clock.js";

const config = readConfig();
const db = openDatabase(config.PGLITE_DIR);
await migrateDatabase(db);
// `question` BR-04: a run cut by the previous stop has no process left to answer.
await createQuestionRepository(db).interruptRunning(systemClock.now());
createApp({
  db,
  clock: systemClock,
  opsDir: config.opsDir,
  claudeSessionsDir: config.claudeSessionsDir,
  claudeProjectsDir: config.claudeProjectsDir,
  claudePluginsFile: config.claudePluginsFile,
  claudeSettingsFile: config.claudeSettingsFile,
  questionRunner: createClaudeRunner({ bin: config.CLAUDE_BIN }),
  sessionLauncher: createClaudeLauncher({ bin: config.CLAUDE_BIN }),
}).listen(config.PORT, config.API_HOST, () => {
  console.log(`api listening on http://${config.API_HOST}:${config.PORT}, reading ${config.opsDir}`);
});
