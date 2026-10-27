export const sessionsKeys = {
  all: ["sessions"] as const,
  list: () => [...sessionsKeys.all, "list"] as const,
  files: (id: string) => [...sessionsKeys.all, "files", id] as const,
  diff: (id: string, file: string) => [...sessionsKeys.all, "diff", id, file] as const,
};
