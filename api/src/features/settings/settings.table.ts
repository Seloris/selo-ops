import { jsonb, pgTable, text } from "drizzle-orm/pg-core";

// Selo Ops' own settings, one row per key (`settings` BR-05): never in Claude Code's settings file.
export const appSettings = pgTable("app_settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
