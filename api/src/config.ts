import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  // The loopback address by default: the API serves the person's sessions and file diffs, never the local network.
  API_HOST: z.string().min(1).default("127.0.0.1"),
  PGLITE_DIR: z.string().default(".data/pglite"),
  SELO_OPS_DIR: z.string().optional(),
  CLAUDE_CONFIG_DIR: z.string().optional(),
  // The Claude Code executable that answers questions (`question` BR-01) and starts sessions (`session` BR-24): `claude` on the PATH by default.
  CLAUDE_BIN: z.string().min(1).default("claude"),
});

export type Config = z.infer<typeof envSchema> & { opsDir: string; claudeSessionsDir: string; claudeProjectsDir: string; claudePluginsFile: string; claudeSettingsFile: string };

// As the selo plugin's ops.mjs resolves it: SELO_OPS_DIR, else CLAUDE_CONFIG_DIR/selo, else ~/.claude/selo.
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.parse(env);
  const configDir = parsed.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  const opsDir = parsed.SELO_OPS_DIR || join(configDir, "selo");
  // Claude Code's status files of running processes (`session` BR-11, BR-12) and its transcripts (`session` BR-12).
  return {
    ...parsed,
    opsDir,
    claudeSessionsDir: join(configDir, "sessions"),
    claudeProjectsDir: join(configDir, "projects"),
    // Claude Code's list of installed plugins (`session` BR-01).
    claudePluginsFile: join(configDir, "plugins", "installed_plugins.json"),
    // Claude Code's user settings file, whose `env` block holds the person's selo settings (`settings` BR-01).
    claudeSettingsFile: join(configDir, "settings.json"),
  };
}
