import type { ReactNode } from "react";
import styles from "./Panel.module.css";

// "wide": a page of figures side by side (the help), up to 1000px.
export function Panel({ children, width = "default" }: { children: ReactNode; width?: "default" | "wide" }) {
  return <div className={width === "wide" ? `${styles.panel} ${styles.wide}` : styles.panel}>{children}</div>;
}
