import { useQuery } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import { projectsKeys } from "./projectsKeys.ts";

// projects FR-13: a file is read when its panel opens, never polled.
export function useProjectFileQuery(projectId: string | null, path: string | null) {
  return useQuery({
    queryKey: projectsKeys.file(projectId ?? "", path ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/projects/{id}/file", { params: { path: { id: projectId ?? "" }, query: { path: path ?? "" } } });
      if (error !== undefined) throw new Error(problemMessage(error));
      return data;
    },
    enabled: projectId !== null && path !== null,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
