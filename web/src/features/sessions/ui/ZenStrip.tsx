import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { FocusIcon, PlusIcon, RefreshIcon } from "../../../shared/ui/icons.tsx";
import { StatusDot } from "../../../shared/ui/StatusDot.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import type { Counts } from "../data/sessionView.ts";
import styles from "./ZenStrip.module.css";

// One setting that is not its default, and how to put it back.
export interface ZenPill {
  key: string;
  label: string;
  onClear(): void;
}

// sessions-live FR-59: the zen mode's strip.
export function ZenStrip({
  counts,
  pills,
  updatedSeconds,
  isRefreshing,
  isNewSessionOff,
  onNewSession,
  onLeave,
}: {
  counts: Counts | null;
  pills: ZenPill[];
  updatedSeconds: number | null;
  isRefreshing: boolean;
  // FR-60: « Lancer les sessions en CLI » is off.
  isNewSessionOff: boolean;
  onNewSession(): void;
  onLeave(): void;
}) {
  return (
    <div className={styles.strip} role="region" aria-label={t("sessions.zen.label")}>
      {counts && (
        <span className={styles.counts}>
          <span>{tn("sessions.subtitle.open", counts.open)}</span>
          <span className={styles.todo}>
            <StatusDot tone="warn" />
            <b>{t("sessions.subtitle.todo", { count: counts.todo })}</b>
          </span>
        </span>
      )}
      {pills.length > 0 && (
        <ul className={styles.pills} aria-label={t("sessions.zen.filters")}>
          {pills.map((p) => (
            <li key={p.key}>
              <Tag removeLabel={t("sessions.zen.clear", { setting: p.label })} onRemove={p.onClear}>
                {p.label}
              </Tag>
            </li>
          ))}
        </ul>
      )}
      <span className={styles.end}>
        {updatedSeconds !== null && (
          <span className={styles.updated}>
            <span className={isRefreshing ? styles.spin : ""}>
              <RefreshIcon />
            </span>
            {t("sessions.updated.text", { seconds: updatedSeconds })}
          </span>
        )}
        <IconButton label={t("sessions.new.open")} tooltip={isNewSessionOff ? t("sessions.new.cliOff") : undefined} disabled={isNewSessionOff} onClick={onNewSession}>
          <PlusIcon />
        </IconButton>
        <IconButton label={t("sessions.zen.leave")} tone="accent" aria-pressed={true} onClick={onLeave}>
          <FocusIcon />
        </IconButton>
      </span>
    </div>
  );
}
