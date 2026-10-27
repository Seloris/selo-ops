// projects FR-18: a project's `.planning/changelog.md`, read into days and entries for its timeline. Never throws:
// a line the format does not foresee still shows, as a « Note » or as the previous entry's continuation.

export type ChangeKind = "added" | "changed" | "fixed" | "other";

export interface ChangeEntry {
  kind: ChangeKind;
  // The word written before the dash when it is not a known kind (`Removed`), else null.
  label: string | null;
  text: string;
  // The blueprint's path from the project's root (`.planning/blueprints/{file}`), when the entry links one.
  blueprint: string | null;
}

export interface ChangeDay {
  // `YYYY-MM-DD`, or null when the heading is not a date.
  date: string | null;
  heading: string;
  entries: ChangeEntry[];
}

// The kinds in English, as selo writes them, and in French, for a project whose repository language is French;
// accents are dropped before the lookup.
const KINDS: Record<string, ChangeKind> = {
  added: "added",
  changed: "changed",
  fixed: "fixed",
  ajout: "added",
  ajoute: "added",
  modification: "changed",
  modifie: "changed",
  change: "changed",
  correction: "fixed",
  corrige: "fixed",
};
const kindOf = (word: string): ChangeKind | undefined => KINDS[word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()];

const BULLET = /^[-*+]\s+(.*)$/;
const HEADING = /^##\s+(.*?)\s*#*\s*$/;
// `Added — text`, the kind bold or not, then an em or en dash or a spaced hyphen; a colon only after a known kind, so
// that `API: …` or `**Title:** …` stay whole.
const KIND_PREFIX = /^\**(\p{L}+)\**\s*([—–:]|\s-)\s*(.*)$/su;
// The trailing ` ([blueprint](blueprints/{file}))`, or a bare ` [blueprint](…)`.
const BLUEPRINT_LINK = /\s*\(?\[[^\]]*\]\(([^)\s]*blueprints\/[^)\s]+)\)\)?\s*$/;

function isDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  return date.getUTCFullYear() === y && date.getUTCMonth() === (m ?? 1) - 1 && date.getUTCDate() === d;
}

// The link is written from `.planning/`: the path given from the project's root, as the side panel opens it.
function blueprintPath(target: string): string {
  const clean = target.replace(/^\.\//, "");
  return clean.startsWith(".planning/") ? clean : `.planning/${clean}`;
}

export function parseEntry(raw: string): ChangeEntry {
  let text = raw.trim();
  let blueprint: string | null = null;
  const link = BLUEPRINT_LINK.exec(text);
  if (link?.[1]) {
    blueprint = blueprintPath(link[1]);
    text = text.slice(0, link.index).trim();
  }
  const prefix = KIND_PREFIX.exec(text);
  const rest = prefix?.[3]?.trim() ?? "";
  if (prefix?.[1] && rest !== "") {
    const kind = kindOf(prefix[1]);
    if (kind) return { kind, label: null, text: rest, blueprint };
    if (prefix[2] !== ":") return { kind: "other", label: prefix[1], text: rest, blueprint };
  }
  return { kind: "other", label: null, text, blueprint };
}

// Newest day first, whatever the file's order (a landing may misplace a heading); a heading that is not a date stays
// on top, in the file's order.
function byDay(a: { day: ChangeDay; i: number }, b: { day: ChangeDay; i: number }): number {
  if (a.day.date === null || b.day.date === null) {
    if (a.day.date === b.day.date) return a.i - b.i;
    return a.day.date === null ? -1 : 1;
  }
  return b.day.date.localeCompare(a.day.date) || a.i - b.i;
}

export function parseChangelog(source: string): ChangeDay[] {
  const days: ChangeDay[] = [];
  let day: ChangeDay | null = null;
  // The raw text of the entry being read, its continuation lines appended.
  let pending: string | null = null;
  const flush = () => {
    if (day && pending !== null && pending.trim() !== "") day.entries.push(parseEntry(pending));
    pending = null;
  };
  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const text = heading[1] ?? "";
      day = { date: isDate(text) ? text : null, heading: text, entries: [] };
      days.push(day);
      continue;
    }
    // The intro before the first day, and the file's title, are not entries.
    if (day === null || /^#/.test(line)) continue;
    const bullet = BULLET.exec(line);
    if (bullet) {
      flush();
      pending = bullet[1] ?? "";
    } else if (line.trim() === "") {
      flush();
    } else if (pending !== null) {
      pending += ` ${line.trim()}`;
    } else {
      // A loose line under a day: kept as an entry of its own.
      pending = line.trim();
    }
  }
  flush();
  return days
    .filter((d) => d.entries.length > 0)
    .map((d, i) => ({ day: d, i }))
    .sort(byDay)
    .map(({ day: d }) => d);
}

export function kindCounts(days: ChangeDay[]): Record<ChangeKind, number> {
  const counts: Record<ChangeKind, number> = { added: 0, changed: 0, fixed: 0, other: 0 };
  for (const d of days) for (const e of d.entries) counts[e.kind] += 1;
  return counts;
}

// « aujourd'hui » and « hier » against the local day `today` (`YYYY-MM-DD`).
export function relativeDay(date: string, today: string): "today" | "yesterday" | null {
  if (date === today) return "today";
  const [y, m, d] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) - 1)).toISOString().slice(0, 10);
  return date === yesterday ? "yesterday" : null;
}

// The local day of a timestamp, as the changelog's headings write it.
export function localDay(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// « 27 octobre 2026 », « 1er octobre 2026 ».
export function frenchDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const text = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return d === 1 ? text.replace(/^1 /, "1er ") : text;
}
