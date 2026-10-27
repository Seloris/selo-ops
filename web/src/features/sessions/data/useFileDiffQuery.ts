import { useQuery } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import type { components } from "../../../api/schema.d.ts";
import { sessionsKeys } from "./sessionsKeys.ts";

export type FileDiff = components["schemas"]["FileDiff"];

// sessions-live FR-51: read each time the file is shown, never on the 5 s refresh (`session` BR-01); a tab shown again
// keeps its last diff on screen while git is read again.
export function useFileDiffQuery(id: string, file: string | null) {
  return useQuery({
    queryKey: sessionsKeys.diff(id, file ?? ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/sessions/{id}/diff", { params: { path: { id }, query: { file: file ?? "" } } });
      if (error !== undefined) throw new Error(problemMessage(error));
      return data;
    },
    enabled: file !== null,
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
