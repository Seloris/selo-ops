import type { CSSProperties, ReactNode } from "react";
import { CloseIcon } from "./icons.tsx";
import styles from "./Tag.module.css";

// An outlined pill: a fact about an item, never a call to act (the Badge is for that).
// Neutral unless `color` (a token, e.g. var(--lane-fastlane)) tints its text, outline and fill.
// `onRemove` adds a « × » named `removeLabel`: a fact that can be taken away (a filter in force).
export function Tag({
  icon,
  color,
  onRemove,
  removeLabel,
  children,
}: {
  icon?: ReactNode;
  color?: string;
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
}) {
  const classes = [styles.tag, color && styles.colored, onRemove && styles.removable].filter(Boolean).join(" ");
  return (
    <span className={classes} style={color ? ({ "--tag-color": color } as CSSProperties) : undefined}>
      {icon}
      {onRemove ? <span className={styles.text}>{children}</span> : children}
      {onRemove && (
        <button type="button" className={styles.remove} aria-label={removeLabel} title={removeLabel} onClick={onRemove}>
          <CloseIcon />
        </button>
      )}
    </span>
  );
}
