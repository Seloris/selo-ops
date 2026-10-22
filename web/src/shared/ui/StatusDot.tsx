import styles from "./StatusDot.module.css";

// warn (amber) and danger (rose) call for action; pulse is work in progress; idle and hollow are at rest.
export type DotTone = "warn" | "danger" | "pulse" | "idle" | "hollow";

export function StatusDot({ tone }: { tone: DotTone }) {
  return <span className={`${styles.dot} ${styles[tone]}`} aria-hidden="true" />;
}
