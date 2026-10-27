import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import { sessionsKeys } from "./sessionsKeys.ts";

export function useUnarchiveSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/v1/sessions/{id}/archive", { params: { path: { id } } });
      if (error !== undefined) throw new Error(problemMessage(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: sessionsKeys.list() }),
  });
}
