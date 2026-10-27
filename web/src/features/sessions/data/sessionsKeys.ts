export const sessionsKeys = {
  all: ["sessions"] as const,
  list: () => [...sessionsKeys.all, "list"] as const,
  diff: (id: string, file: string) => [...sessionsKeys.all, "diff", id, file] as const,
};
