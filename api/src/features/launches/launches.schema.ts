import { z } from "zod";
import { problemDetailsSchema } from "../../shared/errors.js";
import { registry } from "../../shared/openapi.js";

export const launchParamsSchema = z.object({ id: z.string().min(1) });

export const launchSessionSchema = z
  .strictObject({
    // The project's checkout or one of its worktrees, as the projects list gives them.
    folder: z.string().min(1),
    // The session's first prompt. Never a leading dash: Claude Code would read it as an option.
    command: z
      .string()
      .trim()
      .min(1)
      .max(20_000)
      .refine((c) => !c.startsWith("-"), "A command never starts with a dash"),
    // The request or the blueprint the Remote Control name carries.
    title: z.string().trim().min(1).max(2_000),
    isAutoMode: z.boolean(),
  })
  .meta({ id: "LaunchSession" });

export const launchedSessionSchema = z
  .object({
    // The id `claude --bg` printed, null when it printed none.
    id: z.string().nullable(),
    name: z.string(),
    folder: z.string(),
  })
  .meta({ id: "LaunchedSession" });

export type LaunchSession = z.infer<typeof launchSessionSchema>;
export type LaunchedSession = z.infer<typeof launchedSessionSchema>;

const problem = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: problemDetailsSchema } },
});

registry.registerPath({
  method: "post",
  path: "/v1/projects/{id}/sessions",
  summary: "Start a Claude Code session in the background, Remote Control on, the command as its first prompt",
  request: { params: launchParamsSchema, body: { content: { "application/json": { schema: launchSessionSchema } } } },
  responses: {
    201: { description: "The session started", content: { "application/json": { schema: launchedSessionSchema } } },
    400: problem("A folder that is no checkout nor worktree of the project, or an empty or invalid command"),
    404: problem("No such project"),
    409: problem("« Lancer les sessions en CLI » is off"),
    502: problem("Claude Code was not found, or failed to start the session"),
  },
});
