import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, problemMessage } from "../../../api/client.ts";
import type { components } from "../../../api/schema.d.ts";
import { projectsKeys } from "./projectsKeys.ts";

export type Question = components["schemas"]["Question"];
export type AskQuestion = components["schemas"]["AskQuestion"];

export class AskError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// projects FR-21: refreshed every 2 s while one of them runs.
export const QUESTIONS_REFRESH_MS = 2000;

// The questions on one file of the project, or on the whole project (`path` null), with the asking and the deleting.
export function useQuestions(projectId: string | null, path: string | null) {
  const queryClient = useQueryClient();
  const key = projectsKeys.questions(projectId ?? "", path ?? "");
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/projects/{id}/questions", { params: { path: { id: projectId ?? "" }, query: path === null ? {} : { path } } });
      if (error !== undefined) throw new Error(problemMessage(error));
      return data.questions;
    },
    enabled: projectId !== null,
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.some((x) => x.state === "running") ? QUESTIONS_REFRESH_MS : false),
    refetchOnWindowFocus: false,
    retry: false,
  });
  const ask = useMutation({
    mutationFn: async (body: Omit<AskQuestion, "path">) => {
      const { data, error, response } = await api.POST("/v1/projects/{id}/questions", { params: { path: { id: projectId ?? "" } }, body: { ...body, path } });
      // The status says why in French (projects FR-22); the API's own words are English.
      if (error !== undefined) throw new AskError(response.status, problemMessage(error));
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/v1/questions/{id}", { params: { path: { id } } });
      if (error !== undefined) throw new Error(problemMessage(error));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  // Another target's panel starts with no error of the last one.
  const { reset: resetAsk } = ask;
  const { reset: resetRemove } = remove;
  useEffect(() => {
    resetAsk();
    resetRemove();
  }, [projectId, path, resetAsk, resetRemove]);
  return { query, ask, remove };
}
