import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  PGLITE_DIR: z.string().default(".data/pglite"),
  SELO_OPS_DIR: z.string().optional(),
  CLAUDE_CONFIG_DIR: z.string().optional(),
});

export type Config = z.infer<typeof envSchema> & { opsDir: string };

// As the selo plugin's ops.mjs resolves it: SELO_OPS_DIR, else CLAUDE_CONFIG_DIR/selo, else ~/.claude/selo.
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.parse(env);
  const opsDir = parsed.SELO_OPS_DIR || join(parsed.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "selo");
  return { ...parsed, opsDir };
}
