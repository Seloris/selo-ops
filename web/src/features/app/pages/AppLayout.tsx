import { useLayoutEffect, useRef } from "react";
import { Outlet, ScrollRestoration } from "react-router";
import { useTheme } from "../../../shared/lib/theme.ts";
import { AppHeader } from "../ui/AppHeader.tsx";
import styles from "./AppLayout.module.css";

// app FR-03: every page renders under the shared header. The window scrolls, so the keyboard scrolls every page;
// the header's height goes to --app-header-h, for a page that fills the rest of the screen.
export function AppLayout() {
  const [theme, setTheme] = useTheme();
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
      <div ref={headerRef} className={styles.top}>
        <AppHeader theme={theme} onTheme={setTheme} />
      </div>
      <Outlet />
      <ScrollRestoration />
    </div>
  );
}
