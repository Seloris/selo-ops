import { useId, useState, type ReactNode } from "react";
import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { ChevronDownIcon, ChevronRightIcon } from "../../../shared/ui/icons.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import { cacheReuse, exactTokens, formatTokens, hasDroppedPrompts, kindShares, listsRuns, percentText, runRequestText, runTimeText, skillHowLabel, soleModel, topWithRest, totalTokens, widthPercent, type RunUsage, type SessionRun, type Tokens, type Usage } from "./usage.ts";
import styles from "./UsageParts.module.css";

// sessions-live FR-32 to FR-36: what a session consumed, as one dashboard read top-down: the total and its key figures,
// how the tokens split, the models, then the runs (or, for a single run, what that run did), as the export gives it
// (`session` BR-18, BR-19).

// An abbreviated count, the exact one in its tooltip (sessions-live FR-35).
export function TokenCount({ count }: { count: number }) {
  return <span title={t("sessions.usage.exact", { count: exactTokens(count) })}>{formatTokens(count)}</span>;
}

// A one-colour bar on its track: `percent` of the row filled. `kind` colours it like the four kinds, else neutral.
function Meter({ percent, kind }: { percent: number; kind?: keyof Tokens }) {
  return (
    <div className={styles.track} aria-hidden="true">
      <div className={`${styles.fill} ${kind ? styles[kind] : styles.neutral}`} style={{ width: `${percent}%`, minWidth: percent > 0 ? 8 : 0 }} />
    </div>
  );
}

function Heading({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h4 className={styles.heading}>
      {children}
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </h4>
  );
}

function Stat({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.stat} title={hint}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// sessions-live FR-32: the total in large, the sole model beside it, then the calls, the cache reuse and the output.
function Summary({ usage }: { usage: Usage }) {
  const reuse = cacheReuse(usage.tokens);
  const model = soleModel(usage);
  return (
    <div className={styles.summary}>
      <div className={styles.total}>
        <span className={styles.totalValue}><TokenCount count={totalTokens(usage.tokens)} /></span>
        <span className={styles.totalLabel}>
          {t("sessions.usage.totalLabel")}
          {model && (
            <>
              {" · "}
              <span className={styles.mono} title={model}>{model}</span>
            </>
          )}
        </span>
      </div>
      <dl className={styles.stats}>
        <Stat label={t("sessions.usage.calls")}>{exactTokens(usage.calls)}</Stat>
        <Stat label={t("sessions.usage.cacheReuse")} hint={t("sessions.usage.cacheReuseHint")}>{reuse === null ? t("sessions.facts.unknown") : percentText(reuse)}</Stat>
        <Stat label={t("sessions.usage.kind.output")} hint={t("sessions.usage.kindHint.output")}><TokenCount count={usage.tokens.output} /></Stat>
      </dl>
    </div>
  );
}

// sessions-live FR-32: the four kinds, one row each: its colour, its name and what it is, its bar (its share of the
// total), its count and its share.
function KindRows({ tokens }: { tokens: Tokens }) {
  return (
    <ul className={styles.kinds}>
      {kindShares(tokens).map((s) => (
        <li key={s.kind} className={styles.kind}>
          <span className={styles.kindName} title={t(`sessions.usage.kindHint.${s.kind}`)}>
            <span className={`${styles.dot} ${styles[s.kind]}`} />
            <span>
              <b>{t(`sessions.usage.kind.${s.kind}`)}</b>
              <span className={styles.kindHint}>{t(`sessions.usage.kindHint.${s.kind}`)}</span>
            </span>
          </span>
          <Meter percent={s.ratio * 100} kind={s.kind} />
          <b className={styles.figure}><TokenCount count={s.count} /></b>
          <span className={`${styles.figure} ${styles.muted}`}>{percentText(s.ratio)}</span>
        </li>
      ))}
    </ul>
  );
}

// The four kinds on one line, for a run unfolded: a split bar and each kind's count.
function KindLine({ tokens }: { tokens: Tokens }) {
  return (
    <div className={styles.kindLine}>
      <div className={styles.split} aria-hidden="true">
        {kindShares(tokens).map((s) => (
          <span key={s.kind} className={styles[s.kind]} style={{ flexGrow: s.count, minWidth: s.count > 0 ? 4 : 0 }} />
        ))}
      </div>
      <ul className={styles.inlineLegend}>
        {kindShares(tokens).map((s) => (
          <li key={s.kind} title={t(`sessions.usage.kindHint.${s.kind}`)}>
            <span className={`${styles.dot} ${styles[s.kind]}`} />
            {t(`sessions.usage.kind.${s.kind}`)} <b><TokenCount count={s.count} /></b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// sessions-live FR-32: one row per model, the most tokens first, shown only when there are several.
function ModelRows({ usage }: { usage: Usage }) {
  if (usage.byModel.length < 2) return null;
  const models = [...usage.byModel].sort((a, b) => totalTokens(b.tokens) - totalTokens(a.tokens));
  const total = totalTokens(usage.tokens);
  return (
    <section>
      <Heading count={models.length}>{t("sessions.usage.models")}</Heading>
      <ul className={styles.rows}>
        {models.map((m) => {
          const n = totalTokens(m.tokens);
          return (
            <li key={m.model} className={styles.row}>
              <span className={`${styles.rowName} ${styles.mono}`} title={m.model}>{m.model}</span>
              <Meter percent={widthPercent(n, total)} />
              <b className={styles.figure}><TokenCount count={n} /></b>
              <span className={`${styles.figure} ${styles.muted}`}>{percentText(total ? n / total : 0)} · {t("sessions.usage.callsCount", { count: exactTokens(m.calls) })}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// sessions-live FR-33: a ranked list of names with their count and a bar against the most used.
function RankedList({ title, items, rest }: { title: string; items: { key: string; name: string; count: number; note?: string }[]; rest: number }) {
  const max = Math.max(0, ...items.map((i) => i.count));
  return (
    <div>
      <Heading>{title}</Heading>
      {items.length ? (
        <ul className={styles.rows}>
          {items.map((i) => (
            <li key={i.key} className={styles.ranked}>
              <span className={styles.rankedName}>
                <span className={styles.mono} title={i.name}>{i.name}</span>
                {i.note && <span className={styles.muted}>{i.note}</span>}
              </span>
              <Meter percent={widthPercent(i.count, max)} />
              <b className={styles.figure}>{t("sessions.usage.times", { count: i.count })}</b>
            </li>
          ))}
          {rest > 0 && <li className={styles.muted}>{tn("sessions.usage.more", rest)}</li>}
        </ul>
      ) : (
        <p className={styles.muted}>{t("sessions.detail.none")}</p>
      )}
    </div>
  );
}

// sessions-live FR-33, FR-34: what the current run did: its tags, its top tools and skills, then its prompts.
function RunActivity({ run }: { run: RunUsage }) {
  const tools = topWithRest(run.tools);
  const skills = topWithRest(run.skills);
  const maxPrompt = Math.max(0, ...run.prompts.map((p) => totalTokens(p.tokens)));
  return (
    <div className={styles.activity}>
      {(!run.settled || run.partial) && (
        <div className={styles.tags}>
          {!run.settled && <span title={t("sessions.usage.provisionalHint")}><Tag>{t("sessions.usage.provisional")}</Tag></span>}
          {run.partial && <span title={t("sessions.usage.partialHint")}><Tag>{t("sessions.usage.partial")}</Tag></span>}
        </div>
      )}
      <div className={styles.columns}>
        <RankedList title={t("sessions.usage.tools")} items={tools.shown.map((x) => ({ key: x.name, name: x.name, count: x.count }))} rest={tools.rest} />
        <RankedList
          title={t("sessions.usage.skills")}
          items={skills.shown.map((x) => ({ key: `${x.how}:${x.name}`, name: x.name, count: x.count, note: skillHowLabel(x.how) }))}
          rest={skills.rest}
        />
      </div>
      {run.prompts.length > 0 && (
        <section>
          <Heading count={run.prompts.length}>{t("sessions.usage.prompts")}</Heading>
          {hasDroppedPrompts(run) && <p className={styles.note}>{t("sessions.usage.promptsCut")}</p>}
          <ul className={styles.rows}>
            {run.prompts.map((p, i) => {
              const n = totalTokens(p.tokens);
              return (
                <li key={i} className={styles.row}>
                  <span className={`${styles.rowName} ${styles.muted}`}>{p.at ? timeOf(p.at) : t("sessions.facts.unknown")}</span>
                  <Meter percent={widthPercent(n, maxPrompt)} />
                  <b className={styles.figure}><TokenCount count={n} /></b>
                  <span className={`${styles.figure} ${styles.muted}`}>{t("sessions.usage.callsCount", { count: exactTokens(p.calls) })}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// sessions-live FR-36: one run of the list, a header line (time, request, bar against the biggest run, tokens, share of
// the session) that unfolds into its split, calls and models; the current run adds its activity (FR-33).
function RunRow({ run, max, sessionTotal, current, isOpenAtFirst, now }: {
  run: SessionRun;
  max: number;
  sessionTotal: number;
  current: RunUsage | null;
  isOpenAtFirst: boolean;
  now: number;
}) {
  const [isOpen, setOpen] = useState(isOpenAtFirst);
  const detailId = useId();
  const request = runRequestText(run);
  const usage = run.usage;
  const total = usage ? totalTokens(usage.tokens) : 0;
  const model = usage ? soleModel(usage) : null;
  return (
    <li className={`${styles.run} ${isOpen ? styles.runOpen : ""}`}>
      <button type="button" className={styles.runHead} aria-expanded={isOpen} aria-controls={detailId} onClick={() => setOpen(!isOpen)}>
        <span className={styles.chevron}>{isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
        <span className={styles.runTime}>{runTimeText(run.since, now)}</span>
        <span className={styles.runRequest} title={request}>{request}</span>
        {usage ? <Meter percent={widthPercent(total, max)} /> : <span />}
        <b className={styles.figure}>{usage ? <TokenCount count={total} /> : t("sessions.facts.unknown")}</b>
        <span className={`${styles.figure} ${styles.muted} ${styles.share}`}>{usage ? percentText(sessionTotal ? total / sessionTotal : 0) : ""}</span>
      </button>
      <div id={detailId} hidden={!isOpen} className={styles.runBody}>
        {usage ? (
          <>
            <p className={styles.runFacts}>
              {t("sessions.usage.callsCount", { count: exactTokens(usage.calls) })}
              {model && (
                <>
                  {" · "}
                  <span className={styles.mono}>{model}</span>
                </>
              )}
            </p>
            <KindLine tokens={usage.tokens} />
            <ModelRows usage={usage} />
          </>
        ) : (
          <p className={styles.muted}>{t("sessions.usage.noRunUsage")}</p>
        )}
        {current && (
          <>
            <Heading>{t("sessions.usage.activity")}</Heading>
            <RunActivity run={current} />
          </>
        )}
      </div>
    </li>
  );
}

// sessions-live FR-32 to FR-36: the session's summary, split and models, then its runs, the latest first and unfolded;
// a single run matching the session shows only what it did. The export details only the current run (`runUsage`).
export function UsageDashboard({ usage, runs, isRunListCut, runUsage, now }: {
  usage: Usage | null;
  runs: SessionRun[];
  isRunListCut: boolean;
  runUsage: RunUsage | null;
  now: number;
}) {
  const isListed = listsRuns(runs, isRunListCut, usage);
  // With no run list, the current run stands for the session when the export gives no session total.
  const head = usage ?? (isListed ? null : runUsage);
  const sessionTotal = head ? totalTokens(head.tokens) : 0;
  const latestFirst = [...runs].reverse();
  const max = Math.max(0, ...runs.map((r) => (r.usage ? totalTokens(r.usage.tokens) : 0)));
  return (
    <div className={styles.dashboard}>
      {head && (
        <>
          <Summary usage={head} />
          <section>
            <Heading>{t("sessions.usage.split")}</Heading>
            <KindRows tokens={head.tokens} />
          </section>
          <ModelRows usage={head} />
        </>
      )}
      {isListed ? (
        <section>
          <Heading count={runs.length}>{t("sessions.usage.runs")}</Heading>
          {isRunListCut && <p className={styles.note}>{t("sessions.usage.runsCut")}</p>}
          <ul className={styles.runs}>
            {latestFirst.map((r, i) => (
              <RunRow key={r.since} run={r} max={max} sessionTotal={sessionTotal} current={i === 0 ? runUsage : null} isOpenAtFirst={i === 0} now={now} />
            ))}
          </ul>
        </section>
      ) : runUsage ? (
        <section>
          <Heading>{t("sessions.usage.activity")}</Heading>
          <RunActivity run={runUsage} />
        </section>
      ) : (
        !head && <p className={styles.muted}>{t("sessions.usage.noRunUsage")}</p>
      )}
    </div>
  );
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
