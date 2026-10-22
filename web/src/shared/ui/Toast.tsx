import type { ReactNode } from "react";
import { IconButton } from "./IconButton.tsx";
import { CloseIcon } from "./icons.tsx";
import styles from "./Toast.module.css";

// A short message at the bottom of the screen; the caller decides when it goes.
export function Toast({ title, children, closeLabel, onClose }: { title: string; children?: ReactNode; closeLabel: string; onClose: () => void }) {
  return (
    <div className={styles.toast} role="status">
      <div className={styles.body}>
        <span className={styles.title}>{title}</span>
        {children}
      </div>
      <IconButton label={closeLabel} onClick={onClose}>
        <CloseIcon />
      </IconButton>
    </div>
  );
}
