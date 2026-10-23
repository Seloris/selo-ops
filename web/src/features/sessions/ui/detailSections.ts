// sessions-live FR-31: the sections of the detail the person folded, remembered in the browser for every session,
// one set for the side panel and one for the full screen.

export const DETAIL_SECTIONS = ["awaited", "close", "recap", "agents", "usage", "files", "settings"] as const;
export type DetailSection = (typeof DETAIL_SECTIONS)[number];

export type DetailLayout = "panel" | "fullscreen";
export type FoldedSections = Record<DetailLayout, DetailSection[]>;

// The side panel opens what to do with the session and folds how it ran; the full screen has room for everything.
export const DEFAULT_FOLDED: Readonly<Record<DetailLayout, readonly DetailSection[]>> = {
  panel: ["files", "usage", "agents", "settings"],
  fullscreen: [],
};

const isSection = (value: unknown): value is DetailSection => DETAIL_SECTIONS.includes(value as DetailSection);

// What the browser's storage holds for one layout: a list of known sections, else that layout's default.
function parseList(raw: unknown, layout: DetailLayout): DetailSection[] {
  return Array.isArray(raw) ? [...new Set(raw.filter(isSection))] : [...DEFAULT_FOLDED[layout]];
}

export function parseFoldedSections(raw: unknown): FoldedSections {
  const o = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return { panel: parseList(o.panel, "panel"), fullscreen: parseList(o.fullscreen, "fullscreen") };
}

export function toggleSection(folded: FoldedSections, layout: DetailLayout, section: DetailSection): FoldedSections {
  const list = folded[layout];
  return { ...folded, [layout]: list.includes(section) ? list.filter((s) => s !== section) : [...list, section] };
}
