import { useLayoutEffect, useRef, useState } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { useSessionFlags } from "../../../shared/lib/flags.ts";
import { useNotifySetting } from "../../../shared/lib/notifications.ts";
import { t } from "../../../shared/lib/i18n/index.ts";
import { useTheme } from "../../../shared/lib/theme.ts";
import { Toast } from "../../../shared/ui/Toast.tsx";
import { useSaveSettingsMutation } from "../../settings/data/useSaveSettingsMutation.ts";
import { useSettingsQuery } from "../../settings/data/useSettingsQuery.ts";
import { SettingsDialog } from "../../settings/ui/SettingsDialog.tsx";
import { useStateNotifier } from "../data/useStateNotifier.ts";
import { HelpDialog } from "../../help/ui/HelpDialog.tsx";
import { AppHeader } from "../ui/AppHeader.tsx";

// app FR-03: every page renders under the shared header, which scrolls away with the page;
// its height goes to --app-header-h, for a page that fills the rest of the screen.
export function AppLayout() {
  const [theme, setTheme] = useTheme();
  const notify = useNotifySetting();
  const { notifyIds } = useSessionFlags();
  useStateNotifier(notify.states, notifyIds);
  const { pathname } = useLocation();
  // The page the popup was opened on: on another page (back, forward), it is closed, never left over the new page.
  const [helpOpenOn, setHelpOpenOn] = useState<string | null>(null);
  const isHelpOpen = helpOpenOn === pathname;
  // app FR-08: the settings window, read from the file at each opening (its time as the query's key), null while closed.
  const [settingsOpening, setSettingsOpening] = useState<number | null>(null);
  const settingsQuery = useSettingsQuery(settingsOpening);
  const saveSettings = useSaveSettingsMutation();
  const [savedToast, setSavedToast] = useState<number | null>(null);
  // Closed while a save runs, the save still ends with its toast: its state is cleared at the next opening only.
  const openSettings = () => {
    if (!saveSettings.isPending) saveSettings.reset();
    setSettingsOpening(Date.now());
  };
  const closeSettings = () => setSettingsOpening(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => shellRef.current?.style.setProperty("--app-header-h", `${header.offsetHeight}px`);
    // Before the first paint too: the observer reports only after it.
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={shellRef}>
      <div ref={headerRef}>
        <AppHeader theme={theme} onTheme={setTheme} notify={notify} isHelpPage={pathname === "/help"} onHelp={() => setHelpOpenOn(pathname)} onSettings={openSettings} />
      </div>
      <Outlet />
      {isHelpOpen && <HelpDialog onClose={() => setHelpOpenOn(null)} />}
      {settingsOpening !== null && (
        <SettingsDialog
          settings={settingsQuery.data ?? null}
          loadError={settingsQuery.isError ? settingsQuery.error.message || t("settings.dialog.errorUnknown") : null}
          isSaving={saveSettings.isPending}
          saveError={saveSettings.isError ? saveSettings.error.message || t("settings.dialog.errorUnknown") : null}
          onSave={(changes) =>
            saveSettings.mutate(changes, {
              // app FR-11: the window closes, a toast says so.
              onSuccess: () => {
                closeSettings();
                setSavedToast(Date.now());
              },
            })
          }
          onClose={closeSettings}
        />
      )}
      {savedToast !== null && (
        <Toast key={savedToast} title={t("settings.toast.title")} duration={3_500} closeLabel={t("app.toast.close")} onClose={() => setSavedToast(null)}>
          <span>{t("settings.toast.detail")}</span>
        </Toast>
      )}
      <ScrollRestoration />
    </div>
  );
}
