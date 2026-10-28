import { useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { t } from "../../../shared/lib/i18n/index.ts";
import { useNow } from "../../../shared/lib/useNow.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { RefreshIcon } from "../../../shared/ui/icons.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import { PageTitle } from "../../../shared/ui/PageTitle.tsx";
import { Segmented } from "../../../shared/ui/Segmented.tsx";
import { Select } from "../../../shared/ui/Select.tsx";
import { age } from "../../sessions/ui/sessionText.ts";
import { exactTokens, formatTokens, totalTokens } from "../../sessions/ui/usage.ts";
import { useStatsQuery } from "../data/useStatsQuery.ts";
import { BarList, DailyChart, KindLegend, StatsSection, StatsTiles, TokenCount, TopSessions } from "../ui/StatsParts.tsx";
import { PERIODS, cacheSharePercent, flowColor, flowLabel, isEmptyPeriod, parseFilters, writeFilters, type Filters, type Period } from "../ui/statsView.ts";
import styles from "./StatsPage.module.css";

const periodLabel = (period: Period) => t(`stats.period.${period}`);

// stats FR-01 to FR-11: the tokens of the period, per day, project, model and type of work, and the top sessions.
export function StatsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = parseFilters(params);
  const query = useStatsQuery(filters);
  const now = useNow(1000);

  const setFilters = useCallback((patch: Partial<Filters>) => setParams((p) => writeFilters(p, { ...parseFilters(p), ...patch })), [setParams]);

  const stats = query.data;
  // stats FR-02: the project chosen stays in the menu, even in a period where it has no usage.
  const options = useMemo(() => {
    const list = stats?.projectOptions ?? [];
    const chosen = stats?.project ?? null;
    return chosen !== null && !list.some((o) => o.id === chosen.id) ? [...list, chosen] : list;
  }, [stats]);
  const projectName = filters.project === null ? t("stats.page.allProjects") : (options.find((o) => o.id === filters.project)?.name ?? "");
  const updatedSeconds = query.dataUpdatedAt ? Math.max(0, Math.floor((now - query.dataUpdatedAt) / 1000)) : null;
  const errorText = query.error?.message || t("stats.page.errorUnknown");
  const isEmpty = stats ? isEmptyPeriod(stats) : true;
  const cache = stats ? cacheSharePercent(stats.totals.tokens) : null;

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <div className={styles.brand}>
          <PageTitle>{t("stats.page.title")}</PageTitle>
          <p className={styles.sub}>
            {periodLabel(filters.period)} · <b>{projectName}</b>
          </p>
        </div>
        <span className={styles.grow} />
        {updatedSeconds !== null && (
          <span className={styles.updated}>
            <span className={query.isFetching ? styles.spin : ""}>
              <RefreshIcon />
            </span>
            {t("stats.updated.text", { seconds: updatedSeconds })}
          </span>
        )}
      </div>
      <div className={styles.filters}>
        <Segmented label={t("stats.filter.period")} value={filters.period} onChange={(period) => setFilters({ period })} options={PERIODS.map((p) => ({ value: p, label: periodLabel(p) }))} />
        <Select aria-label={t("stats.filter.project")} value={filters.project ?? ""} onChange={(e) => setFilters({ project: e.target.value || null })}>
          <option value="">{t("stats.page.allProjects")}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </div>
      <main className={styles.content}>
        {query.isPending ? (
          <LoadingState>{t("stats.page.loading")}</LoadingState>
        ) : !stats ? (
          <div className={styles.error}>
            <ErrorMessage>{t("stats.page.error", { message: errorText })}</ErrorMessage>
            <Button size="sm" onClick={() => void query.refetch()}>
              {t("stats.page.retry")}
            </Button>
          </div>
        ) : (
          <>
            {query.isError && <ErrorMessage>{t("stats.page.refreshError", { message: errorText })}</ErrorMessage>}
            <StatsTiles
              tiles={[
                { label: t("stats.tile.tokens"), value: <TokenCount n={totalTokens(stats.totals.tokens)} /> },
                { label: t("stats.tile.calls"), value: exactTokens(stats.totals.calls) },
                { label: t("stats.tile.sessions"), value: exactTokens(stats.totals.sessions) },
                { label: t("stats.tile.questions"), value: exactTokens(stats.totals.questions) },
                { label: t("stats.tile.output"), value: <TokenCount n={stats.totals.tokens.output} /> },
                { label: t("stats.tile.cache"), value: cache === null ? t("stats.tile.none") : `${cache} %`, hint: t("stats.tile.cacheHint") },
              ]}
            />
            <div className={styles.grid}>
              <StatsSection title={t("stats.chart.title")} isEmpty={isEmpty} wide>
                <KindLegend />
                <DailyChart stats={stats} />
                {stats.granularity === "week" && <p className={styles.note}>{t("stats.chart.weekly")}</p>}
                {stats.undated && (
                  <p className={styles.note}>
                    {t("stats.chart.undated", { tokens: formatTokens(totalTokens(stats.undated.tokens)), calls: exactTokens(stats.undated.calls) })}
                  </p>
                )}
              </StatsSection>
              <StatsSection title={t("stats.projects.title")} isEmpty={isEmpty}>
                <BarList
                  total={stats.totals.tokens}
                  rows={stats.projects.map((p) => ({
                    key: p.id,
                    label: p.name,
                    tokens: p.tokens,
                    calls: p.calls,
                    sessions: p.sessions,
                    onPick: () => setFilters({ project: p.id }),
                    pickLabel: t("stats.projects.pick", { project: p.name }),
                  }))}
                />
              </StatsSection>
              <StatsSection title={t("stats.models.title")} isEmpty={isEmpty}>
                <BarList total={stats.totals.tokens} rows={stats.models.map((m) => ({ key: m.model, label: m.model, isMono: true, tokens: m.tokens, calls: m.calls }))} />
              </StatsSection>
              <StatsSection title={t("stats.flows.title")} isEmpty={isEmpty}>
                <BarList
                  total={stats.totals.tokens}
                  rows={stats.flows.map((f) => {
                    const color = flowColor(f.flow);
                    return { key: f.flow, label: flowLabel(f.flow), isMono: color !== undefined, tokens: f.tokens, calls: f.calls, ...(color ? { color } : {}) };
                  })}
                />
              </StatsSection>
              <StatsSection title={t("stats.top.title")} isEmpty={isEmpty || stats.topSessions.length === 0} wide>
                <TopSessions sessions={stats.topSessions} ageOf={(iso) => age(now - Date.parse(iso))} onOpen={(id) => void navigate(`/?session=${encodeURIComponent(id)}`)} />
              </StatsSection>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
