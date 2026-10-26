import { z } from "zod";
import { problemDetailsSchema } from "../../shared/errors.js";
import { registry } from "../../shared/openapi.js";
import { BLUEPRINT_STATES } from "../sessions/sessions.export.js";

// `project` BR-02: the export's states, in the order the page shows them.
export const blueprintStateSchema = z.enum(BLUEPRINT_STATES).meta({ id: "BlueprintState" });

const commitSchema = z.object({ sha: z.string(), subject: z.string(), at: z.string() });

export const sheetSchema = z
  .object({
    kind: z.enum(["page", "domain", "app"]),
    slug: z.string(),
    // The front a page belongs to when the project has several; null otherwise.
    component: z.string().nullable(),
    // Relative to the project's root: what the file route takes.
    file: z.string(),
    title: z.string(),
    route: z.string().nullable(),
    // A page stub: its file holds the line `Status: to bootstrap`, its spec is not written yet.
    isStub: z.boolean(),
    frCount: z.number().int(),
    brCount: z.number().int(),
    // Its open questions: the `Q-NN` items its file still holds (a settled one is retired).
    questionCount: z.number().int(),
    nextFr: z.string(),
    nextBr: z.string(),
    lastCommit: commitSchema.nullable(),
    // Names of the open blueprints whose header or delta touches the sheet.
    openBlueprints: z.array(z.string()),
  })
  .meta({ id: "SpecSheet" });

export const blueprintSchema = z
  .object({
    name: z.string(),
    file: z.string(),
    title: z.string(),
    // Page and domain slugs of its header.
    sheets: z.array(z.string()),
    components: z.array(z.string()),
    state: blueprintStateSchema,
    delta: z.array(z.object({ sheet: z.string(), op: z.string(), id: z.string(), text: z.string() })),
    decisions: z.array(z.string()),
    // `project` BR-03: empty for a legacy blueprint.
    stages: z.array(z.object({ number: z.number().int(), component: z.string(), commit: z.string(), sha: z.string().nullable(), isDone: z.boolean() })),
    isReviewDone: z.boolean(),
    isSpecMerged: z.boolean(),
    nextPrompt: z.string().nullable(),
    // The live sessions working on it, in any checkout of the project.
    sessionIds: z.array(z.string()),
    // `project` BR-01: the worktree's branch when only a worktree holds it; null when the base checkout does.
    worktreeBranch: z.string().nullable(),
    modifiedAt: z.string().nullable(),
  })
  .meta({ id: "Blueprint" });

// sessions-live FR-50: a mockup to build.
export const mockupSchema = z
  .object({
    file: z.string(),
    title: z.string(),
    // `project` BR-01: the worktree's branch when only a worktree holds it; null when the base checkout does.
    worktreeBranch: z.string().nullable(),
  })
  .meta({ id: "Mockup" });

// `project` BR-05: a run of the app on a slot of one of the project's checkouts.
export const projectSlotSchema = z
  .object({
    number: z.number().int(),
    root: z.string(),
    // The checkout's branch.
    branch: z.string().nullable(),
    startedAt: z.string().nullable(),
    isRunning: z.boolean(),
    components: z.array(z.object({ name: z.string(), mode: z.string(), url: z.string() })),
  })
  .meta({ id: "ProjectSlot" });

export const projectSchema = z
  .object({
    // The export key of its base checkout.
    id: z.string(),
    name: z.string(),
    root: z.string(),
    branch: z.string().nullable(),
    baseBranch: z.string().nullable(),
    seloVersion: z.string().nullable(),
    changedCount: z.number().int().nullable(),
    unpushedCount: z.number().int().nullable(),
    // `project` BR-04: false when the export read no selo planning; then only the git counts are filled.
    hasPlanning: z.boolean(),
    error: z.string().nullable(),
    worktrees: z.array(z.object({ root: z.string(), branch: z.string().nullable(), aheadCount: z.number().int().nullable(), changedCount: z.number().int().nullable() })),
    sheets: z.array(sheetSchema),
    // Newest first.
    blueprints: z.array(blueprintSchema),
    // Newest first.
    mockups: z.array(mockupSchema),
    ideaCount: z.number().int(),
    debtCount: z.number().int(),
    // The live sessions in its base checkout or one of its worktrees.
    sessionIds: z.array(z.string()),
    // By slot number.
    slots: z.array(projectSlotSchema),
  })
  .meta({ id: "ProjectOverview" });

export const projectsResponseSchema = z.object({ projects: z.array(projectSchema) }).meta({ id: "ProjectsResponse" });

export const projectParamsSchema = z.object({ id: z.string().min(1) });
export const projectFileQuerySchema = z.object({ path: z.string().min(1) });
export const projectFileResponseSchema = z.object({ path: z.string(), text: z.string() }).meta({ id: "ProjectFile" });

export type Project = z.infer<typeof projectSchema>;
export type Blueprint = z.infer<typeof blueprintSchema>;
export type Mockup = z.infer<typeof mockupSchema>;
export type SpecSheet = z.infer<typeof sheetSchema>;
export type ProjectSlot = z.infer<typeof projectSlotSchema>;
export type ProjectsResponse = z.infer<typeof projectsResponseSchema>;
export type ProjectFileResponse = z.infer<typeof projectFileResponseSchema>;

const problem = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: problemDetailsSchema } },
});

registry.registerPath({
  method: "get",
  path: "/v1/projects",
  summary: "Every project of the ops export, its checkouts merged per repository, with its specs and blueprints",
  responses: {
    200: { description: "The projects", content: { "application/json": { schema: projectsResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/projects/{id}/file",
  summary: "The raw Markdown of a planning file the export lists for the project, or its ideas or technical debt",
  request: { params: projectParamsSchema, query: projectFileQuerySchema },
  responses: {
    200: { description: "The file's text", content: { "application/json": { schema: projectFileResponseSchema } } },
    400: problem("The path is missing"),
    404: problem("No such project, a path the export does not list, or a file that cannot be read"),
  },
});
