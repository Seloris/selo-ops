import { z } from "zod";
import { problemDetailsSchema } from "../../shared/errors.js";
import { registry } from "../../shared/openapi.js";
import { tokensSchema } from "../sessions/sessions.schema.js";
import { PRESETS, TARGET_KINDS } from "./questions.prompt.js";

export const QUESTION_TEXT_MAX = 2000;

// `question` BR-04.
export const questionStateSchema = z.enum(["running", "answered", "failed"]).meta({ id: "QuestionState" });
export const questionErrorSchema = z.enum(["interrupted", "timeout", "missing-binary", "run-failed"]).meta({ id: "QuestionError" });
export const questionPresetSchema = z.enum(PRESETS).meta({ id: "QuestionPreset" });

export const questionSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    targetKind: z.enum(TARGET_KINDS),
    // The file asked about, relative to the project's root; null for all the specs or the whole project.
    path: z.string().nullable(),
    preset: questionPresetSchema.nullable(),
    text: z.string().nullable(),
    state: questionStateSchema,
    // Markdown, in French.
    answer: z.string().nullable(),
    error: questionErrorSchema.nullable(),
    // Claude Code's own words on a failed run.
    errorDetail: z.string().nullable(),
    model: z.string().nullable(),
    durationMs: z.number().int().nullable(),
    // `question` BR-04: all the run's models together; null while running, on a failure, or for an answer kept without them.
    // Its shape inline: a nullable reference to a component also used non-null types as `Tokens & Record<string, never>` in the web.
    tokens: z.object(tokensSchema.shape).nullable(),
    askedAt: z.string(),
    answeredAt: z.string().nullable(),
  })
  .meta({ id: "Question" });

export const questionsResponseSchema = z.object({ questions: z.array(questionSchema) }).meta({ id: "QuestionsResponse" });

export const projectQuestionsParamsSchema = z.object({ id: z.string().min(1) });
// No path: the questions on the whole project, or on all the specs with `kind=specs`.
export const questionsQuerySchema = z
  .object({ path: z.string().min(1).optional(), kind: z.literal("specs").optional() })
  .refine((query) => query.path === undefined || query.kind === undefined, { message: "Give a path or kind=specs, not both" });

// `question` BR-03: a preset on a file, or a free text.
export const askQuestionSchema = z
  .object({
    path: z.string().min(1).nullable().optional(),
    // All the specs of the project, with no path.
    kind: z.literal("specs").optional(),
    preset: questionPresetSchema.optional(),
    text: z.string().trim().min(1).max(QUESTION_TEXT_MAX).optional(),
  })
  .superRefine((body, ctx) => {
    if ((body.preset === undefined) === (body.text === undefined)) ctx.addIssue({ code: "custom", path: ["text"], message: "Give a preset or a text, not both" });
    if (body.preset !== undefined && (body.path ?? null) === null) ctx.addIssue({ code: "custom", path: ["preset"], message: "A preset needs a file" });
    if (body.kind !== undefined && (body.path ?? null) !== null) ctx.addIssue({ code: "custom", path: ["kind"], message: "All the specs take no file" });
  })
  .meta({ id: "AskQuestion" });

export const questionParamsSchema = z.object({ id: z.string().min(1) });

export type QuestionDto = z.infer<typeof questionSchema>;
export type AskQuestion = z.infer<typeof askQuestionSchema>;

const problem = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: problemDetailsSchema } },
});

registry.registerPath({
  method: "get",
  path: "/v1/projects/{id}/questions",
  summary: "The questions asked on one file of the project, or on the whole project, newest first",
  request: { params: projectQuestionsParamsSchema, query: questionsQuerySchema },
  responses: {
    200: { description: "The questions", content: { "application/json": { schema: questionsResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/projects/{id}/questions",
  summary: "Ask a headless Claude Code run a question on a blueprint, a sheet, or the whole project",
  request: { params: projectQuestionsParamsSchema, body: { content: { "application/json": { schema: askQuestionSchema } } } },
  responses: {
    202: { description: "The question, running", content: { "application/json": { schema: questionSchema } } },
    400: problem("No preset nor text, both, an empty or too long text, a preset on all the specs or the whole project, or all the specs with a file"),
    404: problem("No such project, or a file that is no blueprint nor sheet of it"),
    409: problem("Three runs already work"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/questions/{id}",
  summary: "Delete a question, stopping its run when it works",
  request: { params: questionParamsSchema },
  responses: {
    204: { description: "Deleted" },
    404: problem("No such question"),
  },
});
