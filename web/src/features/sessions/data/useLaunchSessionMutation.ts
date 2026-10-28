import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import type { components } from "../../../api/schema.d.ts";
import { sessionsKeys } from "./sessionsKeys.ts";

export type LaunchSession = components["schemas"]["LaunchSession"];

// sessions-live FR-62: the problem's code tells why the start failed (`cli_launch_off`, `claude_not_found`, `launch_failed`).
export class LaunchFailure extends Error {
  readonly code: string | null;

  constructor(code: string | null, message: string) {
    super(message);
    this.code = code;
    this.name = "LaunchFailure";
  }
}

// `session` BR-24: a session started in the background; the export lists it once its first hook runs.
export function useLaunchSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, body }: { projectId: string; body: LaunchSession }) => {
      const { data, error } = await api.POST("/v1/projects/{id}/sessions", { params: { path: { id: projectId } }, body });
      if (error !== undefined) throw new LaunchFailure(error.code ?? null, problemMessage(error));
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKeys.list() }),
  });
}
