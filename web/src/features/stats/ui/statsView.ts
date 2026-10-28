import type { components } from "../../../api/schema.d.ts";
import { t, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import { TOKEN_KINDS, cacheReuse, totalTokens, type Tokens } from "../../sessions/ui/usage.ts";

// The stats page's pure rules: its filters in the address, its shares and bar heights, its labels. No React.

export type Stats = components["schemas"]["StatsResponse"];
export type Period = components["schemas"]["StatsPeriod"];
export type Bucket = components["schemas"]["StatsBucket"];
export type TokenKind = (typeof TOKEN_KINDS)[number];

export const PERIODS: readonly Period[] = ["7d", "30d", "90d", "all"];
export const DEFAULT_PERIOD: Period = "7d";

export interface Filters {
  period: Period;
  project: string | null;
}

const isPeriod = (value: string | null): value is Period => PERIODS.some((p) => p === value);

// stats FR-02: the address keeps the period and the project; the default period is left out of it.
export function parseFilters(params: URLSearchParams): Filters {
  const period = params.get("period");
  return { period: isPeriod(period) ? period : DEFAULT_PERIOD, project: params.get("project") || null };
}

export function writeFilters(params: URLSearchParams, { period, project }: Filters): URLSearchParams {
  const next = new URLSearchParams(params);
  if (period === DEFAULT_PERIOD) next.delete("period");
  else next.set("period", period);
  if (project === null) next.delete("project");
  else next.set("project", project);
  return next;
}

// stats FR-03: « Cache lu » over « Entrée », « Cache lu » and « Cache écrit », in whole percent; null when nothing was read.
export function cacheSharePercent(tokens: Tokens): number | null {
  const ratio = cacheReuse(tokens);
  return ratio === null ? null : Math.round(ratio * 100);
}

export interface Bar {
  start: string;
  total: number;
  // The bar's height against the top bucket, in percent.
  percent: number;
  // Each kind's height against the top bucket, in percent: stacked, they make the bar.
  kinds: Record<TokenKind, number>;
}

// stats FR-05: every bar against the bucket with the most tokens.
export function barHeights(buckets: readonly Bucket[]): Bar[] {
  const max = Math.max(0, ...buckets.map((b) => totalTokens(b.tokens)));
  const of = (n: number) => (max > 0 ? (n / max) * 100 : 0);
  return buckets.map((b) => {
    const total = totalTokens(b.tokens);
    return {
      start: b.start,
      total,
      percent: of(total),
      kinds: Object.fromEntries(TOKEN_KINDS.map((k) => [k, of(b.tokens[k])])) as Record<TokenKind, number>,
    };
  });
}

// stats FR-10: a question counts tokens and no call, so both are looked at.
export const isEmptyPeriod = (stats: Pick<Stats, "totals">) => stats.totals.calls === 0 && totalTokens(stats.totals.tokens) === 0;

const FLOWS: Record<string, MessageKey> = {
  free: "stats.flow.free",
  questions: "stats.flow.questions",
  undated: "stats.flow.undated",
};

// stats FR-08: the types of work; a lane keeps its own name, an unknown flow shows as the export names it.
export const flowLabel = (flow: string) => (FLOWS[flow] ? t(FLOWS[flow]) : flow);

const LANES: ReadonlySet<string> = new Set(["free", "fastlane", "blueprint", "pilot"]);

// sessions-live FR-29: a lane in its colour; the questions and the undated part stay neutral.
export const flowColor = (flow: string): string | undefined => (LANES.has(flow) ? `var(--lane-${flow})` : undefined);

const dayDate = (day: string) => new Date(`${day}T12:00:00`);

// stats FR-05: « mar. 10 mars » for a day, « sem. du 9 mars » for a week; the year when it is not the period's last one.
export function bucketLabel(start: string, granularity: Stats["granularity"], to: string): string {
  const date = dayDate(start);
  const withYear = start.slice(0, 4) !== to.slice(0, 4);
  const day = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
  return granularity === "week" ? t("stats.chart.week", { day }) : `${date.toLocaleDateString("fr-FR", { weekday: "short" })} ${day}`;
}

// The axis' short label: the day of the month, a week's Monday likewise.
export const axisLabel = (start: string) => String(dayDate(start).getDate());

// A share of the total, as the sessions' usage shows it.
export const shareOf = (tokens: Tokens, total: Tokens) => {
  const all = totalTokens(total);
  return all > 0 ? totalTokens(tokens) / all : 0;
};
