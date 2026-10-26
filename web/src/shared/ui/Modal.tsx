import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button.tsx";
import { IconButton } from "./IconButton.tsx";
import { CloseIcon, CollapseIcon, ExpandIcon } from "./icons.tsx";
import styles from "./Modal.module.css";

// A large native dialog over the page, open while mounted: Échap, « Fermer » or a click on the backdrop closes it.
// `footer` stays at the bottom of the box while the body scrolls. With `fullscreen` labels, an icon button beside « Fermer » fills the screen with it (the browser's too); Échap then leaves the full screen first.
export function Modal({
  title,
  closeLabel,
  fullscreen,
  footer,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  fullscreen?: { enter: string; exit: string };
  footer?: ReactNode;
  onClose(): void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [isFull, setFull] = useState(false);
  const titleId = useId();
  // Where the press began: a text selection dragged out onto the backdrop must not close the dialog.
  const pressTarget = useRef<EventTarget | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    // Guarded: StrictMode runs effects twice, and showModal() throws on an open dialog.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // The browser's own Échap leaves its full screen: the dialog follows, and the other way round.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (!isFull && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [isFull]);
  const toggleFull = () => {
    if (isFull) return setFull(false);
    setFull(true);
    void ref.current?.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <dialog
      ref={ref}
      className={styles.modal}
      aria-labelledby={titleId}
      onClose={() => {
        // The dialog unmounts on close: leave its full screen now, not in an effect that will never run.
        if (document.fullscreenElement === ref.current) void document.exitFullscreen().catch(() => undefined);
        onClose();
      }}
      onCancel={(event) => {
        // Échap in the full screen only leaves it.
        if (!isFull) return;
        event.preventDefault();
        setFull(false);
      }}
      onPointerDown={(event) => {
        pressTarget.current = event.target;
      }}
      onClick={(event) => {
        // Pressed and released on the dialog itself, outside its box: a click on the backdrop.
        if (event.target === event.currentTarget && pressTarget.current === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className={isFull ? `${styles.box} ${styles.full}` : styles.box}>
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {fullscreen && (
            <span className={styles.fullscreen}>
              <IconButton label={isFull ? fullscreen.exit : fullscreen.enter} aria-pressed={isFull} onClick={toggleFull}>
                {isFull ? <CollapseIcon /> : <ExpandIcon />}
              </IconButton>
            </span>
          )}
          <Button size="sm" onClick={() => ref.current?.close()}>
            <CloseIcon />
            {closeLabel}
          </Button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.foot}>{footer}</div>}
      </div>
    </dialog>
  );
}
