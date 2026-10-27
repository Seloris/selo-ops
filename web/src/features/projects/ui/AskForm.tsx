import { useState } from "react";
import { t } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { Field } from "../../../shared/ui/Field.tsx";
import { TextArea } from "../../../shared/ui/TextArea.tsx";
import type { AskQuestion } from "../data/useQuestions.ts";
import { presetLabel, QUESTION_TEXT_MAX, textCheck } from "./questions.ts";
import styles from "./Questions.module.css";

type Ask = Omit<AskQuestion, "path">;

// projects FR-19, FR-20, FR-22: the presets of a file sent at a click, a free text sent by « Envoyer ». `onAsk` resolves
// false on a refusal or a failed send: the text stays, and `error` says why under the field.
export function AskForm({
  hasPresets,
  isPending,
  error,
  onAsk,
}: {
  hasPresets: boolean;
  isPending: boolean;
  error: string | null;
  onAsk: (ask: Ask) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const check = textCheck(text);
  const send = async () => {
    if (!check.isSendable || isPending) return;
    if (await onAsk({ text: text.trim() })) setText("");
  };
  return (
    <div className={styles.form}>
      {hasPresets && (
        <div className={styles.presets} role="group" aria-label={t("projects.questions.presets")}>
          {(["explain", "summary"] as const).map((preset) => (
            <Button key={preset} size="sm" disabled={isPending} onClick={() => void onAsk({ preset })}>
              {presetLabel(preset)}
            </Button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Field label={t("projects.questions.field")} error={check.isTooLong ? t("projects.questions.tooLong", { max: QUESTION_TEXT_MAX }) : error}>
          {(control) => (
            <TextArea
              {...control}
              rows={3}
              value={text}
              placeholder={t("projects.questions.placeholder")}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Ctrl+Entrée sends, as in a chat; Entrée alone breaks the line.
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          )}
        </Field>
        <div className={styles.sendRow}>
          <span className={`${styles.count} ${check.isTooLong ? styles.over : ""}`}>{t("projects.questions.count", { count: check.count, max: QUESTION_TEXT_MAX })}</span>
          <Button type="submit" variant="primary" size="sm" disabled={!check.isSendable || isPending}>
            {t("projects.questions.send")}
          </Button>
        </div>
      </form>
      <p className={styles.hint}>{t("projects.questions.hint")}</p>
    </div>
  );
}
