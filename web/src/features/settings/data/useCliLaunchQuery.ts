import { useQuery } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import { settingsKeys } from "./settingsKeys.ts";

// sessions-live FR-60: « Lancer les sessions en CLI » (`settings` BR-05), read with the settings, read again when the
// window regains the focus, so that a switch turned on in another browser shows here.
export function useCliLaunchQuery() {
  return useQuery({
    queryKey: settingsKeys.cliLaunch,
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/settings");
      if (error !== undefined) throw new Error(problemMessage(error));
      return data;
    },
  });
}
