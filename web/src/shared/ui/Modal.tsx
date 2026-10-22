import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button.tsx";
import { CloseIcon } from "./icons.tsx";
import styles from "./Modal.module.css";

// A large native dialog over the page, open while mounted: Échap, « Fermer » or a click on the backdrop closes it.
export function Modal({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Where the press began: a text selection dragged out onto the backdrop must not close the dialog.
  const pressTarget = useRef<EventTarget | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    // Guarded: StrictMode runs effects twice, and showModal() throws on an open dialog.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.modal}
      aria-labelledby={titleId}
      onClose={onClose}
      onPointerDown={(event) => {
        pressTarget.current = event.target;
      }}
      onClick={(event) => {
        // Pressed and released on the dialog itself, outside its box: a click on the backdrop.
        if (event.target === event.currentTarget && pressTarget.current === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className={styles.box}>
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <Button size="sm" onClick={() => ref.current?.close()}>
            <CloseIcon />
            {closeLabel}
          </Button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}
