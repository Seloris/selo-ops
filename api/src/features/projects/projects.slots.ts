import { readdirSync, readFileSync } from "node:fs";
import { uptime } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { isPidAlive } from "../sessions/sessions.outside.js";

// A run of the app on a slot, as the selo plugin's run.mjs writes it: {git-common-dir}/selo/slots/{n}.json.
const slotFileSchema = z.object({
  slot: z.number().int(),
  root: z.string(),
  pid: z.number().nullish(),
  boot: z.number().nullish(),
  startedAt: z.string().nullish(),
  stoppedAt: z.string().nullish(),
  components: z
    .array(z.object({ name: z.string(), mode: z.string(), url: z.string(), pid: z.number().nullish() }))
    .nullish()
    .catch(null),
});

export interface SlotRun {
  slot: number;
  root: string;
  startedAt: string | null;
  isRunning: boolean;
  components: { name: string; mode: string; url: string }[];
}

export interface SlotReader {
  // The slot files of a repository, from its git common dir; never written (`project` BR-05).
  read(gitDir: string): SlotRun[];
}

// `project` BR-05, as the plugin's slots.mjs isLive: not stopped, recorded since this boot (Windows reuses pids fast),
// its supervisor or one of its components alive.
export const isLiveRun = (rec: z.infer<typeof slotFileSchema>, bootTime: number, alive: (pid: number) => boolean) =>
  rec.stoppedAt == null &&
  rec.boot != null &&
  Math.abs(rec.boot - bootTime) < 120_000 &&
  [rec.pid, ...(rec.components ?? []).map((c) => c.pid)].some((pid) => pid != null && alive(pid));

export function createSlotReader({ alive = isPidAlive, bootTime = () => Date.now() - uptime() * 1000 } = {}): SlotReader {
  return {
    read: (gitDir) => {
      const dir = join(gitDir, "selo", "slots");
      let files: string[];
      try {
        files = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f));
      } catch {
        return [];
      }
      const boot = bootTime();
      return files.flatMap((f) => {
        try {
          const rec = slotFileSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8")));
          return [
            {
              slot: rec.slot,
              root: rec.root,
              startedAt: rec.startedAt ?? null,
              isRunning: isLiveRun(rec, boot, alive),
              components: (rec.components ?? []).map(({ name, mode, url }) => ({ name, mode, url })),
            },
          ];
        } catch {
          return [];
        }
      });
    },
  };
}
