// sessions-live FR-31: the sections of the detail the person folded, remembered in the browser for every session.

export const DETAIL_SECTIONS = ["awaited", "close", "recap", "agents", "files", "settings"] as const;
export type DetailSection = (typeof DETAIL_SECTIONS)[number];

const isSection = (value: unknown): value is DetailSection => DETAIL_SECTIONS.includes(value as DetailSection);

// What the browser's storage holds: a list of known sections, else none folded.
export function parseFoldedSections(raw: unknown): DetailSection[] {
  return Array.isArray(raw) ? [...new Set(raw.filter(isSection))] : [];
}

export function toggleSection(folded: readonly DetailSection[], section: DetailSection): DetailSection[] {
  return folded.includes(section) ? folded.filter((s) => s !== section) : [...folded, section];
}
