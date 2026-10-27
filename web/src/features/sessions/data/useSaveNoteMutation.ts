import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import { sessionsKeys } from "./sessionsKeys.ts";

// An empty text removes the note (`session` BR-21).
export function useSaveNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const { error } = await api.PUT("/v1/sessions/{id}/note", { params: { path: { id } }, body: { text } });
      if (error !== undefined) throw new Error(problemMessage(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: sessionsKeys.list() }),
  });
}
