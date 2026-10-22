import type { ComponentProps } from "react";
import styles from "./Button.module.css";

export function Button({
  variant = "quiet",
  size = "md",
  type = "button",
  ...props
}: { variant?: "primary" | "danger" | "quiet" | "ghost"; size?: "md" | "sm" } & Omit<ComponentProps<"button">, "className">) {
  return <button type={type} className={`${styles.btn} ${styles[variant]} ${size === "sm" ? styles.sm : ""}`} {...props} />;
}
