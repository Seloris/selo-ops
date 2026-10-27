import { randomUUID } from "node:crypto";
import type { Clock } from "../../shared/clock.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import type { QuestionTarget } from "../projects/projects.service.js";
import { promptOf } from "./questions.prompt.js";
import type { QuestionRepository } from "./questions.repository.js";
import { RunError, type QuestionRunner } from "./questions.runner.js";
import type { AskQuestion, QuestionDto } from "./questions.schema.js";
import type { Question } from "./questions.table.js";

// `question` BR-05: all projects together.
export const MAX_RUNNING = 3;
// `question` BR-04.
export const RUN_TIMEOUT_MS = 5 * 60_000;

const TIMEOUT = "timeout";
const DELETED = "deleted";

const toDto = (q: Question): QuestionDto => ({
  id: q.id,
  projectId: q.projectId,
  targetKind: q.targetKind as QuestionDto["targetKind"],
  path: q.path,
  preset: q.preset as QuestionDto["preset"],
  text: q.text,
  state: q.state as QuestionDto["state"],
  answer: q.answer,
  error: q.error as QuestionDto["error"],
  errorDetail: q.errorDetail,
  model: q.model,
  durationMs: q.durationMs,
  askedAt: q.askedAt.toISOString(),
  answeredAt: q.answeredAt?.toISOString() ?? null,
});

export function createQuestionService({
  questions,
  projects,
  runner,
  clock,
  timeoutMs = RUN_TIMEOUT_MS,
}: {
  questions: QuestionRepository;
  projects: { questionTarget(id: string, path: string | null): QuestionTarget };
  runner: QuestionRunner;
  clock: Clock;
  timeoutMs?: number;
}) {
  // The runs working now, by question id: counted and reserved before any await, so that two asks never pass the limit.
  const active = new Map<string, AbortController>();

  const failure = (error: unknown, signal: AbortSignal) => {
    if (signal.aborted && signal.reason === TIMEOUT) return { error: "timeout", errorDetail: null };
    if (error instanceof RunError) return { error: error.code, errorDetail: error.detail };
    return { error: "run-failed", errorDetail: error instanceof Error ? error.message : null };
  };

  const work = async (question: Question, cwd: string, prompt: string, controller: AbortController) => {
    const timer = setTimeout(() => controller.abort(TIMEOUT), timeoutMs);
    timer.unref();
    try {
      const result = await runner.run({ cwd, prompt, sessionId: question.runSessionId, signal: controller.signal });
      if (controller.signal.aborted) throw new RunError("run-failed", "stopped");
      await questions.finish(question.id, { state: "answered", answer: result.answer, error: null, errorDetail: null, model: result.model, durationMs: result.durationMs, answeredAt: clock.now() });
    } catch (error) {
      // A deleted question has no row left to fail.
      if (controller.signal.reason === DELETED) return;
      await questions.finish(question.id, { state: "failed", answer: null, ...failure(error, controller.signal), model: null, durationMs: null, answeredAt: clock.now() });
    } finally {
      clearTimeout(timer);
      active.delete(question.id);
    }
  };

  return {
    async list(projectId: string, path: string | null): Promise<QuestionDto[]> {
      return (await questions.list(projectId, path)).map(toDto);
    },

    async ask(projectId: string, input: AskQuestion): Promise<QuestionDto> {
      const path = input.path ?? null;
      const target = projects.questionTarget(projectId, path);
      if (active.size >= MAX_RUNNING) throw new ConflictError("question_limit", `${MAX_RUNNING} questions are already running`);
      const question: Question = {
        id: randomUUID(),
        projectId,
        targetKind: target.kind,
        path,
        preset: input.preset ?? null,
        text: input.text ?? null,
        state: "running",
        answer: null,
        error: null,
        errorDetail: null,
        model: null,
        durationMs: null,
        runSessionId: randomUUID(),
        askedAt: clock.now(),
        answeredAt: null,
      };
      const controller = new AbortController();
      active.set(question.id, controller);
      try {
        await questions.insert(question);
      } catch (error) {
        active.delete(question.id);
        throw error;
      }
      const prompt = promptOf({ kind: target.kind, path, preset: input.preset ?? null, text: input.text ?? null });
      void work(question, target.root, prompt, controller).catch((error: unknown) => console.error(error));
      return toDto(question);
    },

    // `question` BR-06: deleting a running question stops its run.
    async remove(id: string): Promise<void> {
      if ((await questions.find(id)) === undefined) throw new NotFoundError("Question", id);
      active.get(id)?.abort(DELETED);
      await questions.remove(id);
    },
  };
}

export type QuestionService = ReturnType<typeof createQuestionService>;
