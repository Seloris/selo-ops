import { t } from "../../../shared/lib/i18n/index.ts";
import type { NotifySetting } from "../../../shared/lib/notifications.ts";
import type { Theme } from "../../../shared/lib/theme.ts";
import { GearIcon, MoonIcon, QuestionIcon, SunIcon } from "../../../shared/ui/icons.tsx";
import { NavTabs } from "../../../shared/ui/NavTabs.tsx";
import { Segmented } from "../../../shared/ui/Segmented.tsx";
import styles from "./AppHeader.module.css";
import { NotifyMenu } from "./NotifyMenu.tsx";

// app FR-02, FR-03, FR-05 and FR-08: the header every page shares.
export function AppHeader({
  theme,
  onTheme,
  notify,
  isHelpPage,
  onHelp,
  onSettings,
}: {
  theme: Theme;
  onTheme: (theme: Theme) => void;
  notify: NotifySetting;
  // On the help page itself, « Aide » is its current link, not a popup.
  isHelpPage: boolean;
  onHelp(): void;
  onSettings(): void;
}) {
  return (
    <header className={styles.bar}>
      <span className={styles.wordmark}>{t("app.wordmark")}</span>
      <NavTabs
        label={t("app.nav.label")}
        tabs={[
          { label: t("app.nav.live"), to: "/", end: true },
          { label: t("app.nav.projects"), to: "/projects" },
          { label: t("app.nav.debug"), note: t("app.nav.soon") },
        ]}
      />
      <span className={styles.grow} />
      <NavTabs
        label={t("app.nav.helpLabel")}
        tabs={[isHelpPage ? { label: t("app.nav.help"), to: "/help", icon: <QuestionIcon /> } : { label: t("app.nav.help"), onClick: onHelp, icon: <QuestionIcon /> }]}
      />
      {notify.permission !== "unsupported" && <NotifyMenu notify={notify} />}
      <NavTabs label={t("settings.nav.open")} tabs={[{ label: t("settings.nav.open"), onClick: onSettings, icon: <GearIcon /> }]} />
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
