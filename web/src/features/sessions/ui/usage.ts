import { dayTime } from "../../../shared/lib/dayTime.ts";
import { t, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import type { Session } from "../data/sessionView.ts";

// What a session or a run consumed, as the export gives it (`session` BR-18, BR-19): totals, shares, labels. Pure: no React.

export type Usage = NonNullable<Session["usage"]>;
export type RunUsage = NonNullable<Session["runUsage"]>;
export type Tokens = Usage["tokens"];
export type SessionRun = Session["runs"][number];

export const TOKEN_KINDS = ["input", "cacheRead", "cacheWrite", "output"] as const satisfies readonly (keyof Tokens)[];

// The four kinds summed: the figure the card and the per-model rows show.
export const totalTokens = (tokens: Tokens) => TOKEN_KINDS.reduce((n, kind) => n + tokens[kind], 0);

// French typography: a decimal comma and a narrow no-break space before the unit.
const NARROW = " ";
const decimal = (n: number) => n.toFixed(1).replace(".", ",");

// sessions-live FR-35: « 999 », « 1,2 k », « 34 k », « 1,2 M »; one decimal under 10 k, always one in millions.
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  // 9 950 and up round to « 10 k », not « 10,0 k ».
  if (n < 9_950) return `${decimal(n / 1000)}${NARROW}k`;
  if (Math.round(n / 1000) < 1000) return `${Math.round(n / 1000)}${NARROW}k`;
  return `${decimal(n / 1_000_000)}${NARROW}M`;
}

// The exact count, for the tooltip: « 1 234 567 ».
export const exactTokens = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

// sessions-live FR-32: each kind's count and its share of the four summed, in the order of TOKEN_KINDS.
export function kindShares(tokens: Tokens): { kind: (typeof TOKEN_KINDS)[number]; count: number; ratio: number }[] {
  const total = totalTokens(tokens);
  return TOKEN_KINDS.map((kind) => ({ kind, count: tokens[kind], ratio: total ? tokens[kind] / total : 0 }));
}

// sessions-live FR-32: the part of what the model read that came from the cache (cache read over input, cache read and
// cache write); null when it read nothing. Output is written, not read, so it stays out.
export function cacheReuse(tokens: Tokens): number | null {
  const read = tokens.input + tokens.cacheRead + tokens.cacheWrite;
  return read ? tokens.cacheRead / read : null;
}

// « 87 % », « < 1 % » for a share that exists but rounds to nothing.
export function percentText(ratio: number): string {
  if (ratio > 0 && ratio < 0.01) return `< 1${NARROW}%`;
  return `${Math.round(ratio * 100)}${NARROW}%`;
}

// A bar's width against the largest one of its list, in percent.
export const widthPercent = (n: number, max: number) => (max > 0 ? Math.min(100, (n / max) * 100) : 0);

// sessions-live FR-33: the first ones, then how many are left for « + N autres ».
export function topWithRest<T>(items: readonly T[], limit = 5): { shown: T[]; rest: number } {
  return { shown: items.slice(0, limit), rest: Math.max(0, items.length - limit) };
}

const HOW: Record<string, MessageKey> = {
  tool: "sessions.usage.how.tool",
  command: "sessions.usage.how.command",
  preloaded: "sessions.usage.how.preloaded",
};

// How a skill was loaded; a way a later export adds shows as the export names it.
export const skillHowLabel = (how: string) => (HOW[how] ? t(HOW[how]) : how);

// sessions-live FR-36: « 22:30 » for a run of today, « 22 oct. 22:30 » for another day, with the year for another year.
export function runTimeText(iso: string, now: number): string {
  const { day, time, isToday } = dayTime(iso, now);
  return isToday ? time : `${day} ${time}`;
}

// sessions-live FR-36, `session` BR-10: « … » when the export cut the request; an unreadable one says so.
export function runRequestText(run: SessionRun): string {
  if (!run.request) return t("sessions.request.empty");
  return run.isRequestCut ? `${run.request}…` : run.request;
}

// The export keeps a run's latest 50 prompts only (sessions-live FR-34): a full list whose calls fall short of the run's
// says that earlier ones were dropped, the run's totals counting them. A partial run's slice starts mid-run: calls before
// its first whole prompt are in no prompt, so it tells nothing.
export const MAX_PROMPTS = 50;
export function hasDroppedPrompts(run: RunUsage): boolean {
  return !run.partial && run.prompts.length >= MAX_PROMPTS && run.prompts.reduce((n, p) => n + p.calls, 0) < run.calls;
}
