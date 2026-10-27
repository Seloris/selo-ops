export const projectsKeys = {
  all: ["projects"] as const,
  list: () => [...projectsKeys.all, "list"] as const,
  file: (projectId: string, path: string) => [...projectsKeys.all, "file", projectId, path] as const,
  changelog: (projectId: string) => [...projectsKeys.all, "changelog", projectId] as const,
  // `path` empty: the questions on the whole project.
  questions: (projectId: string, path: string) => [...projectsKeys.all, "questions", projectId, path] as const,
};
