import { z } from "zod";
import { problemDetailsSchema } from "../../shared/errors.js";
import { registry } from "../../shared/openapi.js";
import { tokensSchema } from "../sessions/sessions.schema.js";

// stats FR-02: a period of N days is today and the N − 1 days before; `all` is everything the export keeps.
export const STATS_PERIODS = ["7d", "30d", "90d", "all"] as const;
export const statsPeriodSchema = z.enum(STATS_PERIODS).meta({ id: "StatsPeriod" });

export const isTimeZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

export const statsQuerySchema = z.object({
  period: statsPeriodSchema.default("7d"),
  // A project's id, as `/v1/projects` gives it (the export key of its base checkout).
  project: z.string().min(1).optional(),
  // The browser's IANA zone: days and weeks are cut in it.
  tz: z.string().min(1).default("UTC").refine(isTimeZone, { message: "Unknown time zone" }),
});

const amount = { calls: z.number().int(), tokens: tokensSchema };

export const statsBucketSchema = z
  .object({
    // The bucket's first day, `YYYY-MM-DD` in the zone asked; a week starts on a Monday.
    start: z.string(),
    ...amount,
  })
  .meta({ id: "StatsBucket" });

export const statsResponseSchema = z
  .object({
    period: statsPeriodSchema,
    // stats FR-05: `week` under `all` when it spans more than 90 days.
    granularity: z.enum(["day", "week"]),
    // The period's first and last days, `YYYY-MM-DD`.
    from: z.string(),
    to: z.string(),
    totals: z.object({
      ...amount,
      // Sessions with usage in the period.
      sessions: z.number().int(),
      // Answered questions with tokens in the period.
      questions: z.number().int(),
    }),
    // stats FR-04: the part of the sessions' usage the export keeps no run for; under `all` only, null when none.
    undated: z.object(amount).nullable(),
    buckets: z.array(statsBucketSchema),
    // The project asked, named even in a period where it has no usage; null for every project.
    project: z.object({ id: z.string(), name: z.string() }).nullable(),
    // The projects with usage in the period whatever the project asked, by name: the project menu.
    projectOptions: z.array(z.object({ id: z.string(), name: z.string() })),
    // Most tokens first.
    projects: z.array(z.object({ id: z.string(), name: z.string(), sessions: z.number().int(), ...amount })),
    // Most tokens first; tokens of calls with no model are in the totals only.
    models: z.array(z.object({ model: z.string(), ...amount })),
    // `free`, `fastlane`, `blueprint`, `pilot`, `questions`, `undated`, or an unknown flow by its name; most tokens first.
    flows: z.array(z.object({ flow: z.string(), ...amount })),
    // stats FR-09: at most 10, most tokens first.
    topSessions: z.array(
      z.object({
        id: z.string(),
        request: z.string(),
        isRequestCut: z.boolean(),
        isRequestImage: z.boolean(),
        projectId: z.string(),
        projectName: z.string(),
        // `session` BR-22: the current run's flow, skill and mode.
        flow: z.string(),
        skill: z.string().nullable(),
        mode: z.string().nullable(),
        model: z.string().nullable(),
        ...amount,
        updatedAt: z.string(),
      }),
    ),
  })
  .meta({ id: "StatsResponse" });

export type StatsQuery = z.infer<typeof statsQuerySchema>;
export type StatsResponse = z.infer<typeof statsResponseSchema>;

registry.registerPath({
  method: "get",
  path: "/v1/stats",
  summary: "Tokens and calls of the period per day, project, model and type of work, and the top sessions",
  request: { query: statsQuerySchema },
  responses: {
    200: { description: "The stats", content: { "application/json": { schema: statsResponseSchema } } },
    400: { description: "A bad period or time zone", content: { "application/problem+json": { schema: problemDetailsSchema } } },
  },
});
