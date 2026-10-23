import { useEffect, useRef, useState } from "react";
import { copyText } from "../../../shared/lib/clipboard.ts";
import { t } from "../../../shared/lib/i18n/index.ts";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { CheckIcon, PromptIcon } from "../../../shared/ui/icons.tsx";
import type { Session } from "../data/sessionView.ts";
import styles from "./NextAction.module.css";

// sessions-live FR-21: the row's « Action suivante » button copies the command as soon as the pointer rests on it;
// its card shows the command and whether it is copied. A row without one keeps the slot, so the columns stay aligned.
export function NextButton({ session, onCopy }: { session: Session; onCopy: (session: Session) => void }) {
  const [isCopied, setIsCopied] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const command = session.isArchived ? null : session.nextAction;
  if (!command) return <span className={styles.slot} aria-hidden="true" />;
  const icon = isCopied ? <CheckIcon /> : <PromptIcon />;
  return (
    <span className={`${styles.slot} ${isCopied ? styles.copied : ""}`}>
      <IconButton
        label={t("sessions.actions.next")}
        tooltip={
          <span className={styles.tip}>
            <span className={styles.tipTitle}>
              {icon}
              {isCopied ? t("sessions.toast.nextCopied") : t("sessions.actions.next")}
            </span>
            <code className={styles.command}>{command}</code>
          </span>
        }
        onMouseEnter={(e) => {
          const button = e.currentTarget;
          // The pointer must rest a moment: sliding down the list does not copy every row it crosses.
          timer.current = window.setTimeout(() => {
            void copyText(command).then((isDone) => setIsCopied(isDone && button.matches(":hover")));
          }, 300);
        }}
        onMouseLeave={() => {
          window.clearTimeout(timer.current);
          setIsCopied(false);
        }}
        onClick={() => onCopy(session)}
      >
        {icon}
      </IconButton>
    </span>
  );
}
