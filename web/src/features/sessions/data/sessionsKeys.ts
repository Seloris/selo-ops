export const sessionsKeys = {
  all: ["sessions"] as const,
  list: () => [...sessionsKeys.all, "list"] as const,
  trails: (id: string, latestRun: string) => [...sessionsKeys.all, "trails", id, latestRun] as const,
  files: (id: string) => [...sessionsKeys.all, "files", id] as const,
  diff: (id: string, file: string) => [...sessionsKeys.all, "diff", id, file] as const,
};
