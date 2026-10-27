import { createContext, useContext, useLayoutEffect } from "react";

// app FR-03: a page may hide the shared header while it shows (sessions-live FR-58); the layout provides the switch.
export const AppHeaderContext = createContext<(isHidden: boolean) => void>(() => undefined);

export function useHiddenAppHeader(isHidden: boolean) {
  const setHidden = useContext(AppHeaderContext);
  // Before the paint: the header never flashes when the page opens hidden.
  useLayoutEffect(() => {
    setHidden(isHidden);
    return () => setHidden(false);
  }, [isHidden, setHidden]);
}
