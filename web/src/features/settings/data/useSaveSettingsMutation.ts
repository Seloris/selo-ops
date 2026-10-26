import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import type { components } from "../../../api/schema.d.ts";
import { settingsKeys } from "./settingsKeys.ts";

// `settings` BR-03: only the changed keys; the window closes on success, so the next opening reads the file again.
export function useSaveSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (changes: components["schemas"]["SeloSettingChanges"]) => {
      const { data, error } = await api.PATCH("/v1/settings", { body: changes });
      if (error !== undefined) throw new Error(problemMessage(error));
      return data;
    },
    onSuccess: () => queryClient.removeQueries({ queryKey: settingsKeys.all }),
  });
}
