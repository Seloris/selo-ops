import { useId, type ComponentProps, type ReactNode } from "react";
import styles from "./IconButton.module.css";

// An icon-only button: `label` is its accessible name and its tooltip; `tooltip` replaces the browser's one with a
// card shown on hover and keyboard focus.
export function IconButton({
  label,
  tone = "muted",
  tooltip,
  children,
  ...props
}: { label: string; tone?: "muted" | "accent" | "mark"; tooltip?: ReactNode; children: ReactNode } & Omit<
  ComponentProps<"button">,
  "className" | "aria-label" | "title"
>) {
  const tipId = useId();
  const button = (
    <button
      type="button"
      className={`${styles.icon} ${styles[tone]}`}
      aria-label={label}
      title={tooltip === undefined ? label : undefined}
      aria-describedby={tooltip === undefined ? undefined : tipId}
      {...props}
    >
      {children}
    </button>
  );
  if (tooltip === undefined) return button;
  return (
    <span className={styles.wrap}>
      {button}
      <span id={tipId} role="tooltip" className={styles.tip}>
        {tooltip}
      </span>
    </span>
  );
}
