import { useQuery } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import { settingsKeys } from "./settingsKeys.ts";

// app FR-08: read when the window opens (`opening`, null while closed), never polled nor read again under the person's edits.
export function useSettingsQuery(opening: number | null) {
  return useQuery({
    queryKey: settingsKeys.read(opening ?? 0),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/settings");
      if (error !== undefined) throw new Error(problemMessage(error));
      return data;
    },
    enabled: opening !== null,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
