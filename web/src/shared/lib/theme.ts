import { useCallback, useState } from "react";
import { readStored, writeStored } from "./storage.ts";

// app FR-02: Clair / Sombre, Sombre by default, remembered. overrides.css reads the root's data-theme.
export type Theme = "light" | "dark";

const KEY = "selo-ops/theme";

export function readTheme(): Theme {
  return readStored(KEY) === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    writeStored(KEY, next);
    setThemeState(next);
  }, []);
  return [theme, setTheme];
}
