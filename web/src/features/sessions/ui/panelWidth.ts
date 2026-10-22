// sessions-live FR-27: the width the person gives the detail, bounded so both sides stay usable.
// The page's CSS applies the same bounds again when the window shrinks.

export const MIN_PANEL_WIDTH = 360;
export const MIN_LIST_WIDTH = 560;
// One arrow key press on the edge.
export const PANEL_WIDTH_STEP = 16;

export function clampPanelWidth(width: number, totalWidth: number): number {
  const max = Math.max(MIN_PANEL_WIDTH, totalWidth - MIN_LIST_WIDTH);
  return Math.round(Math.min(max, Math.max(MIN_PANEL_WIDTH, width)));
}

// A width read back from the browser's storage: a positive number, else none.
export function parsePanelWidth(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
}
