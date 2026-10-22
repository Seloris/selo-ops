import { t, tn } from "../../../shared/lib/i18n/index.ts";
import type { Theme } from "../../../shared/lib/theme.ts";
import { MoonIcon, RefreshIcon, SunIcon } from "../../../shared/ui/icons.tsx";
import { PageTitle } from "../../../shared/ui/PageTitle.tsx";
import { Segmented } from "../../../shared/ui/Segmented.tsx";
import { StatusDot } from "../../../shared/ui/StatusDot.tsx";
import type { Counts } from "../data/sessionView.ts";
import styles from "./SessionsHeader.module.css";

// sessions-live FR-01 and FR-02, app FR-02.
export function SessionsHeader({
  counts,
  updatedSeconds,
  isRefreshing,
  theme,
  onTheme,
}: {
  counts: Counts | null;
  updatedSeconds: number | null;
  isRefreshing: boolean;
  theme: Theme;
  onTheme: (theme: Theme) => void;
}) {
  return (
    <header className={styles.top}>
      <div className={styles.brand}>
        <span className={styles.wordmark}>{t("app.wordmark")}</span>
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
      <Segmented
        label={t("app.theme.label")}
        value={theme}
        onChange={onTheme}
        options={[
          { value: "light", label: t("app.theme.light"), icon: <SunIcon /> },
          { value: "dark", label: t("app.theme.dark"), icon: <MoonIcon /> },
        ]}
      />
    </header>
  );
}
