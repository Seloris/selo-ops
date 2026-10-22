import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { migrateDatabase, openDatabase, type Database } from "../src/db/client.js";
import type { ProjectFile, SessionFile } from "../src/features/sessions/sessions.export.js";
import type { Clock } from "../src/shared/clock.js";
import { rootKeyOf } from "./factories.js";

const EPOCH = "2026-01-01T00:00:00.000Z";

export interface TestClock extends Clock {
  set(iso: string): void;
}

export function createTestClock(): TestClock {
  let current = new Date(EPOCH);
  return {
    now: () => current,
    set: (iso) => {
      current = new Date(iso);
    },
  };
}

// The ops export the API reads: a temporary folder per test file, emptied by reset().
function createOpsDir() {
  const dir = mkdtempSync(join(tmpdir(), "selo-ops-test-"));
  const write = (sub: string, name: string, content: string) => {
    mkdirSync(join(dir, sub), { recursive: true });
    writeFileSync(join(dir, sub, name), content);
  };
  const seed = {
    session: (file: SessionFile) => write("sessions", `${file.sessionId}.json`, JSON.stringify(file)),
    project: (file: ProjectFile) => write("projects", `${rootKeyOf(file.root)}.json`, JSON.stringify(file)),
    raw: (sub: "sessions" | "projects", name: string, content: string) => write(sub, name, content),
  };
  const clear = () => {
    rmSync(join(dir, "sessions"), { recursive: true, force: true });
    rmSync(join(dir, "projects"), { recursive: true, force: true });
  };
  return { dir, seed, clear };
}

export async function createTestContext() {
  const db: Database = openDatabase();
  await migrateDatabase(db);
  const clock = createTestClock();
  const ops = createOpsDir();
  const app = createApp({ db, clock, opsDir: ops.dir });
  const seed = ops.seed;
  const reset = async () => {
    const tables = await db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name <> '__drizzle_migrations'
    `);
    for (const { table_name } of tables.rows) {
      await db.execute(sql.raw(`truncate table "${table_name}" cascade`));
    }
    ops.clear();
    clock.set(EPOCH);
  };
  return { app, db, clock, seed, reset };
}
