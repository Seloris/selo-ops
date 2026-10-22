import type { ReactNode } from "react";
import styles from "./Tag.module.css";

// A neutral outlined pill: a fact about an item, never a call to act (the Badge is for that).
export function Tag({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={styles.tag}>
      {icon}
      {children}
    </span>
  );
}
