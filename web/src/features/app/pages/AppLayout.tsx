import { useLayoutEffect, useRef, useState } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { useNotifySetting } from "../../../shared/lib/notifications.ts";
import { useTheme } from "../../../shared/lib/theme.ts";
import { useStateNotifier } from "../data/useStateNotifier.ts";
import { HelpDialog } from "../../help/ui/HelpDialog.tsx";
import { AppHeader } from "../ui/AppHeader.tsx";

// app FR-03: every page renders under the shared header, which scrolls away with the page;
// its height goes to --app-header-h, for a page that fills the rest of the screen.
export function AppLayout() {
  const [theme, setTheme] = useTheme();
  const notify = useNotifySetting();
  useStateNotifier(notify.states);
  const { pathname } = useLocation();
  // The page the popup was opened on: on another page (back, forward), it is closed, never left over the new page.
  const [helpOpenOn, setHelpOpenOn] = useState<string | null>(null);
  const isHelpOpen = helpOpenOn === pathname;
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
        <AppHeader theme={theme} onTheme={setTheme} notify={notify} isHelpPage={pathname === "/help"} onHelp={() => setHelpOpenOn(pathname)} />
      </div>
      <Outlet />
      {isHelpOpen && <HelpDialog onClose={() => setHelpOpenOn(null)} />}
      <ScrollRestoration />
    </div>
  );
}
