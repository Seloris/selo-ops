import type { ReactNode } from "react";
import { IconButton } from "./IconButton.tsx";
import { CheckIcon, CloseIcon, WarningIcon } from "./icons.tsx";
import styles from "./Toast.module.css";

export type ToastTone = "done" | "warn" | "danger";

const toneIcon: Record<ToastTone, ReactNode> = {
  done: <CheckIcon />,
  warn: <WarningIcon />,
  danger: <WarningIcon />,
};

// A short message at the bottom of the screen. It closes itself after `duration` ms, shown by a bar
// that pauses while the pointer or the focus is on the toast; render it with a new key per message.
export function Toast({
  title,
  children,
  tone = "done",
  icon,
  duration,
  closeLabel,
  onClose,
}: {
  title: string;
  children?: ReactNode;
  tone?: ToastTone;
  icon?: ReactNode;
  duration: number;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className={styles.toast} data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
      <span className={styles.icon}>{icon ?? toneIcon[tone]}</span>
      <div className={styles.body}>
        <span className={styles.title}>{title}</span>
        {children}
      </div>
      <IconButton label={closeLabel} onClick={onClose}>
        <CloseIcon />
      </IconButton>
      <span className={styles.timer} style={{ animationDuration: `${duration}ms` }} onAnimationEnd={onClose} aria-hidden="true" />
    </div>
  );
}
