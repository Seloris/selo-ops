import styles from "./StatusDot.module.css";

// warn (amber) and danger (rose) call for action; pulse (blue) is work in progress; done (green) is finished, turn the same
// green hollow (a turn ended); idle (grey) is neutral, off a hollow grey (closed or archived).
export type DotTone = "warn" | "danger" | "pulse" | "turn" | "idle" | "done" | "off";

export function StatusDot({ tone }: { tone: DotTone }) {
  return <span className={`${styles.dot} ${styles[tone]}`} aria-hidden="true" />;
}
