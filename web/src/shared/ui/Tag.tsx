import type { CSSProperties, ReactNode } from "react";
import styles from "./Tag.module.css";

// An outlined pill: a fact about an item, never a call to act (the Badge is for that).
// Neutral unless `color` (a token, e.g. var(--lane-fastlane)) tints its text, outline and fill.
export function Tag({ icon, color, children }: { icon?: ReactNode; color?: string; children: ReactNode }) {
  return (
    <span
      className={color ? `${styles.tag} ${styles.colored}` : styles.tag}
      style={color ? ({ "--tag-color": color } as CSSProperties) : undefined}
    >
      {icon}
      {children}
    </span>
  );
}
