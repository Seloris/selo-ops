import { useQuery } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import { projectsKeys } from "./projectsKeys.ts";

export const CHANGELOG_FILE = ".planning/changelog.md";

// projects FR-18: the project's changelog, read when its view opens and again every 5 s, as the page (FR-01); null when the project has none
// (a 404), so that « no changelog » and « cannot be read » show apart.
export function useProjectChangelogQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectsKeys.changelog(projectId ?? ""),
    queryFn: async () => {
      const { data, error, response } = await api.GET("/v1/projects/{id}/file", { params: { path: { id: projectId ?? "" }, query: { path: CHANGELOG_FILE } } });
      if (response.status === 404) return null;
      if (error !== undefined) throw new Error(problemMessage(error));
      return data.text;
    },
    enabled: projectId !== null,
    staleTime: 0,
    refetchInterval: 5_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
