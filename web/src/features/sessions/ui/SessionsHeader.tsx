import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { PlusIcon, RefreshIcon } from "../../../shared/ui/icons.tsx";
import { PageTitle } from "../../../shared/ui/PageTitle.tsx";
import { StatusDot } from "../../../shared/ui/StatusDot.tsx";
import type { Counts } from "../data/sessionView.ts";
import styles from "./SessionsHeader.module.css";

// sessions-live FR-01 and FR-02.
export function SessionsHeader({
  counts,
  updatedSeconds,
  isRefreshing,
  plugins,
  onNewSession,
}: {
  counts: Counts | null;
  updatedSeconds: number | null;
  isRefreshing: boolean;
  // The installed selo plugins' versions, already worded; null when unknown.
  plugins: string | null;
  onNewSession(): void;
}) {
  return (
    <div className={styles.top}>
      <div className={styles.brand}>
        <PageTitle>{t("sessions.page.title")}</PageTitle>
        {counts && (
          <p className={styles.sub}>
            <span>
              {tn("sessions.subtitle.open", counts.open)} · {tn("sessions.subtitle.projects", counts.projects)} ·
            </span>
            <span className={styles.todo}>
              <StatusDot tone="warn" />
              <b>{t("sessions.subtitle.todo", { count: counts.todo })}</b>
            </span>
          </p>
        )}
      </div>
      <span className={styles.grow} />
      {plugins && (
        <span className={styles.plugins} title={t("sessions.updated.plugins")}>
          {plugins}
        </span>
      )}
      {updatedSeconds !== null && (
        <span className={styles.updated}>
          <span className={isRefreshing ? styles.spin : ""}>
            <RefreshIcon />
          </span>
          {t("sessions.updated.text", { seconds: updatedSeconds })}
        </span>
      )}
      {/* sessions-live FR-43: below 640 px, its icon alone. */}
      <Button size="sm" aria-label={t("sessions.new.open")} title={t("sessions.new.open")} onClick={onNewSession}>
        <PlusIcon />
        <span className={styles.newLabel}>{t("sessions.new.open")}</span>
      </Button>
    </div>
  );
}
