import { useQuery } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import type { components } from "../../../api/schema.d.ts";
import { sessionsKeys } from "./sessionsKeys.ts";

export type FileSummary = components["schemas"]["FileSummary"];
export type FileStat = FileSummary["files"][number];

// sessions-live FR-54, FR-55: read when « Fichiers modifiés » unfolds or its window opens, never on the 5 s refresh
// (`session` BR-01); `refetch` reads it again when the window opens.
export function useFileSummaryQuery(id: string, isEnabled: boolean) {
  return useQuery({
    queryKey: sessionsKeys.files(id),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/sessions/{id}/files", { params: { path: { id } } });
      if (error !== undefined) throw new Error(problemMessage(error));
      return data;
    },
    enabled: isEnabled && id !== "",
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });
}
