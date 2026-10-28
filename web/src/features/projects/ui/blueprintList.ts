// projects FR-08 and FR-24: the list of blueprints grouped by the period of their date, and its filters.
import { dateOf, sheetKey, sheetLists, type Blueprint, type SpecSheet } from "../data/projectView.ts";

export type Period =
  | { kind: "thisWeek" }
  | { kind: "lastWeek" }
  // The rest of the current month, `YYYY-MM`.
  | { kind: "earlierThisMonth"; month: string }
  | { kind: "month"; month: string }
  | { kind: "undated" };

export interface BlueprintGroup {
  key: string;
  period: Period;
  blueprints: Blueprint[];
  // Open when the list first shows.
  isOpen: boolean;
}

const DAY_MS = 86_400_000;
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const msOf = (day: string) => Date.parse(`${day}T00:00:00Z`);

// The Monday that starts the week of a `YYYY-MM-DD` day.
function mondayOf(day: string): number {
  const ms = msOf(day);
  return ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS;
}

function periodOf(date: string | null, today: string, thisMonday: string, lastMonday: string): Period {
  if (date === null) return { kind: "undated" };
  if (date >= thisMonday) return { kind: "thisWeek" };
  if (date >= lastMonday) return { kind: "lastWeek" };
  const month = date.slice(0, 7);
  return month === today.slice(0, 7) ? { kind: "earlierThisMonth", month } : { kind: "month", month };
}

const keyOf = (p: Period) => (p.kind === "month" ? p.month : p.kind);

// The blueprints, in the order given, split by period, newest period first and the undated last.
export function periodGroups(blueprints: Blueprint[], today: string): BlueprintGroup[] {
  const thisMonday = mondayOf(today);
  const thisMondayDay = toDay(thisMonday);
  const lastMondayDay = toDay(thisMonday - 7 * DAY_MS);
  const groups = new Map<string, BlueprintGroup>();
  for (const b of blueprints) {
    const period = periodOf(dateOf(b), today, thisMondayDay, lastMondayDay);
    const key = keyOf(period);
    const group = groups.get(key);
    if (group) group.blueprints.push(b);
    else groups.set(key, { key, period, blueprints: [b], isOpen: period.kind !== "month" && period.kind !== "undated" });
  }
  const rank = (g: BlueprintGroup) => {
    const p = g.period;
    if (p.kind === "thisWeek") return "3";
    if (p.kind === "lastWeek") return "2";
    if (p.kind === "earlierThisMonth") return "1";
    if (p.kind === "month") return `0${p.month}`;
    return "";
  };
  const sorted = [...groups.values()].sort((a, b) => rank(b).localeCompare(rank(a)));
  return sorted.map((g, i) => (i === 0 ? { ...g, isOpen: true } : g));
}

// « Septembre 2026 », or « septembre » alone with `isBare`.
export function monthLabel(month: string, { isBare = false }: { isBare?: boolean } = {}): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, 1));
  const text = date.toLocaleDateString("fr-FR", isBare ? { month: "long", timeZone: "UTC" } : { month: "long", year: "numeric", timeZone: "UTC" });
  return isBare ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

export interface BlueprintFilter {
  text: string;
  // The chosen sheets, as blueprints name them (`sheetKey`).
  sheets: string[];
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export const hasFilter = (f: BlueprintFilter) => fold(f.text) !== "" || f.sheets.length > 0;

// A blueprint touches a sheet it names in its pages and domain sheets, or in its delta.
const touches = (b: Blueprint, key: string) => b.sheets.includes(key) || b.delta.some((d) => d.sheet === key);

export function filterBlueprints(blueprints: Blueprint[], f: BlueprintFilter): Blueprint[] {
  const text = fold(f.text);
  return blueprints.filter(
    (b) => (text === "" || fold(b.title).includes(text) || fold(b.name).includes(text)) && (f.sheets.length === 0 || f.sheets.some((key) => touches(b, key))),
  );
}

export interface SheetChip {
  key: string;
  sheet: SpecSheet;
  count: number;
}

// One chip per sheet at least one blueprint touches: the pages, then the domain sheets with `app` first.
export function sheetChips(sheets: SpecSheet[], blueprints: Blueprint[]): SheetChip[] {
  const { pages, domains } = sheetLists(sheets);
  return [...pages, ...domains]
    .map((sheet) => {
      const key = sheetKey(sheet);
      return { key, sheet, count: blueprints.filter((b) => touches(b, key)).length };
    })
    .filter((c) => c.count > 0);
}

// The address keeps the filters: `q` for the text, `sheets` for the chosen sheets, comma-separated.
export function parseFilter(params: URLSearchParams): BlueprintFilter {
  return { text: params.get("q") ?? "", sheets: (params.get("sheets") ?? "").split(",").filter((s) => s !== "") };
}

export function writeFilter(f: BlueprintFilter): { q: string | null; sheets: string | null } {
  return { q: f.text === "" ? null : f.text, sheets: f.sheets.length === 0 ? null : f.sheets.join(",") };
}
