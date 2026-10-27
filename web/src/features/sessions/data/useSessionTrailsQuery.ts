import { useQuery } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import type { components } from "../../../api/schema.d.ts";
import { sessionsKeys } from "./sessionsKeys.ts";

export type SessionTrails = components["schemas"]["SessionTrails"];

// sessions-live FR-41: the earlier prompts' history, read when « Déroulé de la session » is shown, never on the 5 s
// refresh; read again once a new prompt starts (`latestRun`, the latest run's start), never else: an earlier run is over.
// Meanwhile the same session's earlier read stays shown, never another session's.
export function useSessionTrailsQuery(id: string, latestRun: string, isEnabled: boolean) {
  return useQuery({
    queryKey: sessionsKeys.trails(id, latestRun),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/sessions/{id}/trails", { params: { path: { id } } });
      if (error !== undefined) throw new Error(problemMessage(error));
      return data;
    },
    enabled: isEnabled && id !== "",
    staleTime: Infinity,
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === id ? previous : undefined),
  });
}
