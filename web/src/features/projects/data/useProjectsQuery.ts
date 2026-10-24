import { useQuery } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import { projectsKeys } from "./projectsKeys.ts";

// projects FR-01: the export is read again every 5 s.
export const REFRESH_MS = 5000;

// `enabled`: sessions-live reads it only while its « Nouvelle session » window is open (FR-44).
export function useProjectsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    enabled,
    queryKey: projectsKeys.list(),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/projects");
      if (error !== undefined) throw new Error(problemMessage(error));
      return data;
    },
    refetchInterval: REFRESH_MS,
  });
}
