import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Drawer.module.css";

// A panel sliding in from the right over the page's edge; the page keeps its content visible beside it.
// It takes the focus when it opens, so Tab and screen readers land in it.
export function Drawer({ isOpen, label, children }: { isOpen: boolean; label: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (isOpen) ref.current?.focus({ preventScroll: true });
  }, [isOpen]);
  return (
    <aside ref={ref} className={`${styles.drawer} ${isOpen ? styles.open : ""}`} tabIndex={-1} aria-label={label} aria-hidden={!isOpen} inert={!isOpen}>
      {children}
    </aside>
  );
}
