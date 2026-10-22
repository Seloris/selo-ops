import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.js";
import { migrateDatabase, openDatabase } from "./db/client.js";
import { seedDemo } from "./seed/demo.js";
import { systemClock } from "./shared/clock.js";

// The demo the browser tests run on: an in-memory database, migrated and seeded at each start, on its
// own port (PORT, given by a run of the app on its slot). Nothing persists, and the developer's server and
// data are never touched: the ops export, Claude Code's status files and transcripts, and the projects' folders it
// reads are in a fresh temporary folder, never ~/.claude. The demo's desktop links are seeded in the database.
const port = Number(process.env.PORT ?? "3101");
const demoDir = mkdtempSync(join(tmpdir(), "selo-ops-demo-"));
const folders = {
  opsDir: join(demoDir, "selo"),
  claudeSessionsDir: join(demoDir, "claude", "sessions"),
  claudeProjectsDir: join(demoDir, "claude", "projects"),
  codeDir: join(demoDir, "code"),
  scratchDir: join(demoDir, "scratch"),
};
const db = openDatabase();
await migrateDatabase(db);
await seedDemo(db, systemClock, folders);
const { opsDir, claudeSessionsDir, claudeProjectsDir } = folders;
createApp({ db, clock: systemClock, opsDir, claudeSessionsDir, claudeProjectsDir }).listen(port, () => {
  console.log(`api demo listening on http://localhost:${port}, reading ${demoDir}`);
});
