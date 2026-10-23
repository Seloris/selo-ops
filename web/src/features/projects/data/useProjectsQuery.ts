import { useQuery } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import { projectsKeys } from "./projectsKeys.ts";

// projects FR-01: the export is read again every 5 s.
export const REFRESH_MS = 5000;

export function useProjectsQuery() {
  return useQuery({
    queryKey: projectsKeys.list(),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/projects");
      if (error !== undefined) throw new Error(problemMessage(error));
      return data;
    },
    refetchInterval: REFRESH_MS,
  });
}
