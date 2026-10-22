import type { ComponentProps, ReactNode } from "react";
import styles from "./IconButton.module.css";

// An icon-only button: `label` is its accessible name and its tooltip.
export function IconButton({
  label,
  tone = "muted",
  children,
  ...props
}: { label: string; tone?: "muted" | "accent"; children: ReactNode } & Omit<ComponentProps<"button">, "className" | "aria-label" | "title">) {
  return (
    <button type="button" className={`${styles.icon} ${styles[tone]}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
