import styles from "./StatusDot.module.css";

// warn (amber) and danger (rose) call for action; pulse is work in progress; idle is at rest; done (green) is finished.
export type DotTone = "warn" | "danger" | "pulse" | "idle" | "done";

export function StatusDot({ tone }: { tone: DotTone }) {
  return <span className={`${styles.dot} ${styles[tone]}`} aria-hidden="true" />;
}
