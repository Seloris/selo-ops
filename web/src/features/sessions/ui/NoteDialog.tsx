import { useEffect, useRef, useState } from "react";
import { t } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { Field } from "../../../shared/ui/Field.tsx";
import { TextInput } from "../../../shared/ui/TextInput.tsx";
import styles from "./NoteDialog.module.css";

export const NOTE_MAX = 200;

// sessions-live FR-40: a small dialog to write, change or clear a session's note; open while mounted.
export function NoteDialog({
  note,
  isPending,
  error,
  onSave,
  onClose,
}: {
  note: string | null;
  isPending: boolean;
  error: string | null;
  onSave(text: string): void;
  onClose(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(note ?? "");

  useEffect(() => {
    const dialog = ref.current;
    // Guarded: StrictMode runs effects twice, and showModal() throws on an open dialog.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="note-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!isPending) onClose();
      }}
      // A repeated Échap closes it whatever `cancel` does: the page forgets it, the next « Note » mounts a new one.
      onClose={onClose}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(text.trim());
        }}
      >
        <h2 id="note-dialog-title">{t("sessions.note.title")}</h2>
        <p className={styles.hint}>{t("sessions.note.hint")}</p>
        <Field label={t("sessions.note.label")} error={error}>
          {(control) => <TextInput {...control} value={text} maxLength={NOTE_MAX} autoFocus onChange={(event) => setText(event.target.value)} />}
        </Field>
        <span className={styles.count}>{t("sessions.note.count", { count: text.trim().length, max: NOTE_MAX })}</span>
        <div className={styles.actions}>
          {note !== null && (
            <span className={styles.push}>
              <Button variant="danger" disabled={isPending} onClick={() => onSave("")}>
                {t("sessions.note.clear")}
              </Button>
            </span>
          )}
          <Button variant="quiet" disabled={isPending} onClick={onClose}>
            {t("sessions.note.cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {t("sessions.note.save")}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
