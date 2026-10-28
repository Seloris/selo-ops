import { useState, type CSSProperties, type ReactNode } from "react";
import { t, tn, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import { EmptyState } from "../../../shared/ui/EmptyState.tsx";
import { GaugeIcon } from "../../../shared/ui/icons.tsx";
import { laneColor, workLabel } from "../../sessions/ui/sessionText.ts";
import { TOKEN_KINDS, exactTokens, formatTokens, percentText, runRequestText, totalTokens, widthPercent, type Tokens } from "../../sessions/ui/usage.ts";
import { axisLabel, barHeights, bucketLabel, type Stats } from "./statsView.ts";
import styles from "./StatsParts.module.css";

const KIND_CLASS = { input: styles.kindInput, cacheRead: styles.kindCacheRead, cacheWrite: styles.kindCacheWrite, output: styles.kindOutput } as const;
const kindLabel = (kind: (typeof TOKEN_KINDS)[number]) => t(`sessions.usage.kind.${kind}` as MessageKey);

// A count abbreviated (sessions-live FR-35), the exact one on hover.
export function TokenCount({ n }: { n: number }) {
  return <span title={t("stats.row.tokensHint", { count: exactTokens(n) })}>{formatTokens(n)}</span>;
}

// A section of the page: its title on the stats hue, then its content, or the empty period's message (stats FR-10).
export function StatsSection({ title, isEmpty, wide = false, children }: { title: string; isEmpty: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`${styles.section} ${wide ? styles.wide : ""}`}>
      <h2 className={styles.sectionTitle}>
        <span className={styles.chip}>
          <GaugeIcon />
        </span>
        {title}
      </h2>
      {isEmpty ? <EmptyState>{t("stats.page.empty")}</EmptyState> : children}
    </section>
  );
}

// stats FR-03: the period's figures.
export function StatsTiles({ tiles }: { tiles: { label: string; value: ReactNode; hint?: string }[] }) {
  return (
    <dl className={styles.tiles} aria-label={t("stats.tile.label")}>
      {tiles.map((tile) => (
        <div key={tile.label} className={styles.tile} title={tile.hint}>
          <dt className={styles.tileLabel}>{tile.label}</dt>
          <dd className={styles.tileValue}>{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function KindLegend() {
  return (
    <ul className={styles.legend}>
      {TOKEN_KINDS.map((kind) => (
        <li key={kind}>
          <span className={`${styles.swatch} ${KIND_CLASS[kind]}`} />
          {kindLabel(kind)}
        </li>
      ))}
    </ul>
  );
}

// At most about 15 labels under the axis, the last bar always named.
const labelStep = (count: number) => Math.max(1, Math.ceil(count / 15));

// stats FR-05: one stacked bar per day (per week beyond 90 days), drawn by hand; hovering or focusing a bar shows its figures.
export function DailyChart({ stats }: { stats: Pick<Stats, "buckets" | "granularity" | "to"> }) {
  const [active, setActive] = useState<number | null>(null);
  const bars = barHeights(stats.buckets);
  const step = labelStep(bars.length);
  return (
    <div className={styles.chartScroll}>
      <div className={styles.chart} role="list" aria-label={t("stats.chart.label")} style={{ "--bars": bars.length } as CSSProperties} onMouseLeave={() => setActive(null)}>
        {bars.map((bar, i) => {
          const bucket = stats.buckets[i];
          const label = bucketLabel(bar.start, stats.granularity, stats.to);
          const isActive = active === i;
          const side = i < 3 ? styles.tipStart : i >= bars.length - 3 ? styles.tipEnd : "";
          return (
            <div key={bar.start} role="listitem" className={styles.column}>
              <button
                type="button"
                className={`${styles.barHit} ${isActive ? styles.barActive : ""}`}
                aria-label={`${label} · ${t("stats.chart.total", { tokens: exactTokens(bar.total) })}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <span className={styles.bar} style={{ height: `${bar.percent}%` }}>
                  {TOKEN_KINDS.map((kind) =>
                    bar.kinds[kind] > 0 ? <span key={kind} className={KIND_CLASS[kind]} style={{ flexGrow: bar.kinds[kind] }} /> : null,
                  )}
                </span>
              </button>
              <span className={styles.axis} aria-hidden="true">
                {i % step === 0 || i === bars.length - 1 ? axisLabel(bar.start) : ""}
              </span>
              {isActive && bucket && (
                <div className={`${styles.tip} ${side}`} role="tooltip">
                  <b>{label}</b>
                  <span>{t("stats.chart.total", { tokens: exactTokens(bar.total) })}</span>
                  {TOKEN_KINDS.map((kind) => (
                    <span key={kind} className={styles.tipRow}>
                      <span className={`${styles.swatch} ${KIND_CLASS[kind]}`} />
                      {kindLabel(kind)} <span className={styles.tipValue}>{exactTokens(bucket.tokens[kind])}</span>
                    </span>
                  ))}
                  <span>{t("stats.chart.calls", { count: exactTokens(bucket.calls) })}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface BarRow {
  key: string;
  label: string;
  // A lane's colour for a type of work (sessions-live FR-29).
  color?: string;
  isMono?: boolean;
  tokens: Tokens;
  calls: number;
  sessions?: number;
  // stats FR-06: a project's row sets the project menu to it.
  onPick?: () => void;
  pickLabel?: string;
}

// stats FR-06 to FR-08: rows by tokens, most first, each bar against the first, its share of the period's total.
export function BarList({ rows, total }: { rows: BarRow[]; total: Tokens }) {
  const max = totalTokens(rows[0]?.tokens ?? total);
  const all = totalTokens(total);
  return (
    <ul className={styles.rows}>
      {rows.map((row) => {
        const n = totalTokens(row.tokens);
        const name = (
          <span className={`${styles.rowName} ${row.isMono ? styles.mono : ""}`} style={row.color ? { color: row.color } : undefined}>
            {row.label}
          </span>
        );
        return (
          <li key={row.key} className={styles.row}>
            {row.onPick ? (
              <button type="button" className={styles.rowPick} title={row.pickLabel} onClick={row.onPick}>
                {name}
              </button>
            ) : (
              name
            )}
            <span className={styles.track}>
              <span className={styles.fill} style={{ width: `${widthPercent(n, max)}%`, ...(row.color ? { background: row.color } : {}) }} />
            </span>
            <span className={styles.figure}>
              <TokenCount n={n} />
            </span>
            <span className={styles.share}>{percentText(all > 0 ? n / all : 0)}</span>
            <span className={styles.meta}>
              {t("stats.row.calls", { count: exactTokens(row.calls) })}
              {row.sessions !== undefined && ` · ${tn("stats.row.sessions", row.sessions)}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// stats FR-09: the sessions with the most tokens; a click opens the session's detail on Live.
export function TopSessions({ sessions, ageOf, onOpen }: { sessions: Stats["topSessions"]; ageOf: (iso: string) => string; onOpen: (id: string) => void }) {
  return (
    <ol className={styles.top}>
      {sessions.map((s) => {
        const work = { isOutsideSelo: false, flow: s.flow, skill: s.skill, mode: s.mode, substep: null, trail: [] };
        const request = runRequestText(s);
        return (
          <li key={s.id}>
            <button type="button" className={styles.topRow} title={t("stats.top.open")} onClick={() => onOpen(s.id)}>
              <span className={styles.topRequest} title={request}>
                {request}
              </span>
              <span className={styles.topMeta}>
                <span className={styles.mono} style={{ color: laneColor(work) }}>
                  {workLabel(work)}
                </span>
                {" · "}
                {s.projectName}
                {s.model && ` · ${s.model}`}
              </span>
              <span className={styles.topFigures}>
                <b>
                  <TokenCount n={totalTokens(s.tokens)} />
                </b>
                <span>{t("stats.row.calls", { count: exactTokens(s.calls) })}</span>
                <span>{t("stats.top.age", { age: ageOf(s.updatedAt) })}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
