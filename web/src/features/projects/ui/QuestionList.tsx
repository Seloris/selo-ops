import { useState } from "react";
import { t } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog.tsx";
import { EmptyState } from "../../../shared/ui/EmptyState.tsx";
import { StatusDot } from "../../../shared/ui/StatusDot.tsx";
import type { Question } from "../data/useQuestions.ts";
import { Markdown } from "./Markdown.tsx";
import { answerMeta, failureText, questionTitle, stateText } from "./questions.ts";
import styles from "./Questions.module.css";

// projects FR-21: newest first, each with its text, its age and its state; « Supprimer » after a confirmation.
export function QuestionList({
  questions,
  now,
  age,
  isDeleting,
  deleteError,
  onDelete,
}: {
  questions: Question[];
  now: number;
  age: (ms: number) => string;
  isDeleting: boolean;
  deleteError: string | null;
  // Resolves true once deleted: the confirmation closes; false keeps it open with its error.
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState<Question | null>(null);
  if (questions.length === 0) return <EmptyState>{t("projects.questions.empty")}</EmptyState>;
  return (
    <>
      <ul className={styles.list} aria-label={t("projects.questions.list")}>
        {questions.map((q) => (
          <li key={q.id} className={styles.item}>
            <div className={styles.itemHead}>
              <span className={`${styles.itemTitle} ${q.preset !== null ? styles.preset : ""}`}>{questionTitle(q)}</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(q)}>
                {t("projects.questions.delete")}
              </Button>
            </div>
            <div className={styles.itemMeta}>
              <span className={`${styles.state} ${styles[q.state]}`}>
                {q.state === "running" && <StatusDot tone="pulse" />}
                {stateText(q, now, age)}
              </span>
              <span>{t("projects.questions.age", { age: age(now - Date.parse(q.askedAt)) })}</span>
              {q.state === "answered" && <span className={styles.mono}>{answerMeta(q, age)}</span>}
            </div>
            {q.state === "answered" && (
              <div className={styles.answer}>
                <Markdown source={q.answer ?? ""} />
              </div>
            )}
            {q.state === "failed" && <p className={styles.failure}>{failureText(q)}</p>}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        isOpen={confirming !== null}
        title={t("projects.questions.deleteTitle")}
        message={t("projects.questions.deleteMessage")}
        confirmLabel={t("projects.questions.delete")}
        cancelLabel={t("projects.questions.deleteCancel")}
        isPending={isDeleting}
        error={deleteError}
        onConfirm={() => {
          if (confirming === null) return;
          void onDelete(confirming.id).then((isDeleted) => {
            if (isDeleted) setConfirming(null);
          });
        }}
        onCancel={() => setConfirming(null)}
      >
        {confirming && <p className={styles.confirmText}>{questionTitle(confirming)}</p>}
      </ConfirmDialog>
    </>
  );
}
