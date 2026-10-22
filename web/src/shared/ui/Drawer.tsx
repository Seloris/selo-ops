import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import styles from "./Drawer.module.css";

export interface DrawerResize {
  label: string;
  // Bounds of the width, announced to screen readers.
  min: number;
  max: number;
  // Pixels one arrow key press moves the edge.
  step: number;
  // While the edge moves; the panel's width is the caller's to apply.
  onResize: (width: number) => void;
  // Once it stops (or on an arrow key press).
  onResizeEnd: (width: number) => void;
  // A double click on the edge.
  onReset: () => void;
}

// A panel sliding in from the right over the page's edge; the page keeps its content visible beside it.
// It takes the focus when it opens, so Tab and screen readers land in it.
// With `resize`, its left edge drags (or moves with the arrow keys) to change its width.
export function Drawer({ isOpen, label, resize, children }: { isOpen: boolean; label: string; resize?: DrawerResize; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ startX: number; startWidth: number; width: number } | null>(null);
  const [shownWidth, setShownWidth] = useState(0);
  const measure = useCallback(() => setShownWidth(Math.round(ref.current?.getBoundingClientRect().width ?? 0)), []);

  useEffect(() => {
    if (isOpen) ref.current?.focus({ preventScroll: true });
  }, [isOpen]);

  // The width as shown, for the separator's value: it follows the window and every change of the edge.
  const isResizable = resize !== undefined;
  useEffect(() => {
    const el = ref.current;
    if (!isOpen || !isResizable || !el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen, isResizable, measure]);

  const currentWidth = () => ref.current?.getBoundingClientRect().width ?? 0;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!resize || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const width = currentWidth();
    drag.current = { startX: e.clientX, startWidth: width, width };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!resize || !drag.current) return;
    // The edge is on the left: moving it left widens the panel.
    drag.current.width = drag.current.startWidth + drag.current.startX - e.clientX;
    resize.onResize(drag.current.width);
  };
  const onPointerEnd = () => {
    if (!resize || !drag.current) return;
    const { startWidth, width } = drag.current;
    drag.current = null;
    // A click with no move keeps the width as it is.
    if (width !== startWidth) resize.onResizeEnd(width);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!resize || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    resize.onResizeEnd(currentWidth() + (e.key === "ArrowLeft" ? resize.step : -resize.step));
  };

  return (
    <aside ref={ref} className={`${styles.drawer} ${isOpen ? styles.open : ""}`} tabIndex={-1} aria-label={label} aria-hidden={!isOpen} inert={!isOpen}>
      {resize && (
        <div
          className={styles.handle}
          role="separator"
          aria-orientation="vertical"
          aria-label={resize.label}
          aria-valuemin={resize.min}
          aria-valuemax={resize.max}
          aria-valuenow={Math.min(resize.max, Math.max(resize.min, shownWidth))}
          title={resize.label}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
          onDoubleClick={resize.onReset}
          onKeyDown={onKeyDown}
        />
      )}
      {children}
    </aside>
  );
}
