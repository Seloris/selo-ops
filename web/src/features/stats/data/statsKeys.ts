import type { Period } from "../ui/statsView.ts";

export const statsKeys = {
  all: ["stats"] as const,
  // `project` empty: every project.
  read: (period: Period, project: string, tz: string) => [...statsKeys.all, "read", period, project, tz] as const,
};
