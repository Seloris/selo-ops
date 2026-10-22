import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { RefreshIcon } from "../../../shared/ui/icons.tsx";
import { PageTitle } from "../../../shared/ui/PageTitle.tsx";
import { StatusDot } from "../../../shared/ui/StatusDot.tsx";
import type { Counts } from "../data/sessionView.ts";
import styles from "./SessionsHeader.module.css";

// sessions-live FR-01 and FR-02.
export function SessionsHeader({
  counts,
  updatedSeconds,
  isRefreshing,
}: {
  counts: Counts | null;
  updatedSeconds: number | null;
  isRefreshing: boolean;
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
      {updatedSeconds !== null && (
        <span className={styles.updated}>
          <span className={isRefreshing ? styles.spin : ""}>
            <RefreshIcon />
          </span>
          {t("sessions.updated.text", { seconds: updatedSeconds })}
        </span>
      )}
    </div>
  );
}
