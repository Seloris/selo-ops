import { useQuery } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import { sessionsKeys } from "./sessionsKeys.ts";

// sessions-live FR-02: the export is read again every 5 s.
export const REFRESH_MS = 5000;

// `inBackground`: keeps reading while the tab is hidden (app FR-05), when the notifications matter most.
export function useSessionsQuery({ enabled = true, inBackground = false }: { enabled?: boolean; inBackground?: boolean } = {}) {
  return useQuery({
    queryKey: sessionsKeys.list(),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/sessions");
      if (error !== undefined) throw new Error(problemMessage(error));
      return data;
    },
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: inBackground,
    enabled,
  });
}
