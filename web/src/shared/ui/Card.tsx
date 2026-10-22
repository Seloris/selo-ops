import type { ReactNode } from "react";
import styles from "./Card.module.css";

// A static block of content on the row tokens: a title and a few lines. No blur (the skin keeps it to the panel).
export function Card({ children }: { children: ReactNode }) {
  return <div className={styles.card}>{children}</div>;
}
