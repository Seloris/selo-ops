import { Button } from "./Button.tsx";
import { CopyIcon } from "./icons.tsx";
import styles from "./CommandBox.module.css";

// A command shown in full, to read before copying it.
export function CommandBox({ command, copyLabel, onCopy }: { command: string; copyLabel: string; onCopy: () => void }) {
  return (
    <div className={styles.box}>
      <code className={styles.code}>{command}</code>
      <Button size="sm" onClick={onCopy}>
        <CopyIcon />
        {copyLabel}
      </Button>
    </div>
  );
}
