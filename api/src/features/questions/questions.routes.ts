import { Router } from "express";
import { inputOf, validate } from "../../shared/validate.js";
import { askQuestionSchema, projectQuestionsParamsSchema, questionParamsSchema, questionsQuerySchema } from "./questions.schema.js";
import type { QuestionService } from "./questions.service.js";

const listInput = { params: projectQuestionsParamsSchema, query: questionsQuerySchema };
const askInput = { params: projectQuestionsParamsSchema, body: askQuestionSchema };
const removeInput = { params: questionParamsSchema };

// Public, like the whole application (see app.ts).
export function questionsRoutes({ questions }: { questions: QuestionService }): Router {
  const router = Router();
  router.get("/v1/projects/:id/questions", validate(listInput), async (_req, res) => {
    const { params, query } = inputOf<typeof listInput>(res);
    const scope = query.path !== undefined ? { path: query.path } : { kind: query.kind ?? ("project" as const) };
    res.json({ questions: await questions.list(params.id, scope) });
  });
  router.post("/v1/projects/:id/questions", validate(askInput), async (_req, res) => {
    const { params, body } = inputOf<typeof askInput>(res);
    res.status(202).json(await questions.ask(params.id, body));
  });
  router.delete("/v1/questions/:id", validate(removeInput), async (_req, res) => {
    const { params } = inputOf<typeof removeInput>(res);
    await questions.remove(params.id);
    res.status(204).end();
  });
  return router;
}
