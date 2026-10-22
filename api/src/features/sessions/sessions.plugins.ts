import { readFileSync } from "node:fs";
import { z } from "zod";
import type { InstalledPlugin } from "./sessions.schema.js";

// Claude Code's list of installed plugins (`session` BR-01): `{ plugins: { "{name}@{marketplace}": [{ version, … }] } }`,
// one entry per scope, so one per project for a plugin installed per project. Only the selo plugins are read.

const SELO_PLUGINS = ["selo", "selo-ops"] as const;

const fileSchema = z.object({ plugins: z.record(z.string(), z.unknown()) });
const entrySchema = z.object({ version: z.string().min(1) });

export interface InstalledPluginReader {
  read(): InstalledPlugin[];
}

// Digit runs compared as numbers, so that 2.10.0 comes before 2.9.0.
const byVersionDesc = (a: string, b: string) => b.localeCompare(a, "en", { numeric: true });

function versionsOf(entries: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((e) => {
    const parsed = entrySchema.safeParse(e);
    return parsed.success ? [parsed.data.version] : [];
  });
}

export function createInstalledPluginReader(file: string): InstalledPluginReader {
  return {
    read: () => {
      let plugins: Record<string, unknown>;
      try {
        const parsed = fileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
        if (!parsed.success) return [];
        plugins = parsed.data.plugins;
      } catch {
        // missing or half-written: no versions until the next read
        return [];
      }
      return SELO_PLUGINS.flatMap((name) => {
        // By plugin name, whatever its marketplace: a selo installed from a fork is still selo.
        const versions = Object.entries(plugins)
          .filter(([key]) => key.split("@")[0] === name)
          .flatMap(([, entries]) => versionsOf(entries));
        const distinct = [...new Set(versions)].sort(byVersionDesc);
        return distinct.length ? [{ name, versions: distinct }] : [];
      });
    },
  };
}
