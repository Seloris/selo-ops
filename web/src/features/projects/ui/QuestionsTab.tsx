import { t } from "../../../shared/lib/i18n/index.ts";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import type { AskQuestion, Question } from "../data/useQuestions.ts";
import { AskForm } from "./AskForm.tsx";
import { QuestionList } from "./QuestionList.tsx";
import styles from "./Questions.module.css";

// What the page reads and does for one target's questions.
export interface QuestionsState {
  questions: Question[] | null;
  isPending: boolean;
  error: string | null;
  isAsking: boolean;
  askError: string | null;
  isDeleting: boolean;
  deleteError: string | null;
  onAsk: (ask: Omit<AskQuestion, "path">) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

// projects FR-19, FR-20: the asking first, then the questions asked.
export function QuestionsTab({ state, hasPresets, now, age }: { state: QuestionsState; hasPresets: boolean; now: number; age: (ms: number) => string }) {
  return (
    <div className={styles.tab}>
      <AskForm hasPresets={hasPresets} isPending={state.isAsking} error={state.askError} onAsk={state.onAsk} />
      {state.isPending ? (
        <LoadingState>{t("projects.questions.loading")}</LoadingState>
      ) : state.error !== null ? (
        <ErrorMessage>{t("projects.questions.loadError", { message: state.error || t("projects.page.errorUnknown") })}</ErrorMessage>
      ) : (
        <QuestionList questions={state.questions ?? []} now={now} age={age} isDeleting={state.isDeleting} deleteError={state.deleteError} onDelete={state.onDelete} />
      )}
    </div>
  );
}
