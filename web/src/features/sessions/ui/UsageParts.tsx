import { useId, useState, type ReactNode } from "react";
import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { ChevronDownIcon, ChevronRightIcon } from "../../../shared/ui/icons.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import { cacheReuse, exactTokens, formatTokens, hasDroppedPrompts, kindShares, percentText, runRequestText, runTimeText, skillHowLabel, topWithRest, totalTokens, widthPercent, type RunUsage, type SessionRun, type Tokens, type Usage } from "./usage.ts";
import styles from "./UsageParts.module.css";

// sessions-live FR-32 to FR-36: what a session consumed, as one dashboard (the session's figures, then each run's), as the export gives it (`session` BR-18, BR-19).

// An abbreviated count, the exact one in its tooltip (sessions-live FR-35).
export function TokenCount({ count }: { count: number }) {
  return <span title={t("sessions.usage.exact", { count: exactTokens(count) })}>{formatTokens(count)}</span>;
}

// A bar of the four kinds side by side, its width the share of `max` (the whole row when omitted). A kind that exists keeps a visible sliver.
function KindBar({ tokens, max }: { tokens: Tokens; max?: number }) {
  const total = totalTokens(tokens);
  const width = max === undefined ? 100 : widthPercent(total, max);
  return (
    <div className={styles.bar} aria-hidden="true">
      <div className={styles.barFill} style={{ width: `${width}%` }}>
        {kindShares(tokens).map((s) => (
          <span key={s.kind} className={`${styles.seg} ${styles[s.kind]}`} style={{ flexGrow: s.count, minWidth: s.count > 0 ? 2 : 0 }} />
        ))}
      </div>
    </div>
  );
}

// The four kinds, one line each: a dot of the kind's colour, its name, its count and its share.
function KindLegend({ tokens }: { tokens: Tokens }) {
  return (
    <ul className={styles.legend}>
      {kindShares(tokens).map((s) => (
        <li key={s.kind}>
          <span className={`${styles.dot} ${styles[s.kind]}`} />
          <span className={styles.kindName}>{t(`sessions.usage.kind.${s.kind}`)}</span>
          <b><TokenCount count={s.count} /></b>
          <span className={styles.muted}>{percentText(s.ratio)}</span>
        </li>
      ))}
    </ul>
  );
}

function Tile({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.tile} title={hint}>
      <span className={styles.tileValue}>{children}</span>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  );
}

// The headline figures: tokens, calls, how much of the reading came from the cache, and what the model wrote.
function Tiles({ usage }: { usage: Usage }) {
  const reuse = cacheReuse(usage.tokens);
  return (
    <div className={styles.tiles}>
      <Tile label={t("sessions.usage.tokens")}><TokenCount count={totalTokens(usage.tokens)} /></Tile>
      <Tile label={t("sessions.usage.calls")}>{exactTokens(usage.calls)}</Tile>
      <Tile label={t("sessions.usage.cacheReuse")} hint={t("sessions.usage.cacheReuseHint")}>{reuse === null ? t("sessions.facts.unknown") : percentText(reuse)}</Tile>
      <Tile label={t("sessions.usage.kind.output")}><TokenCount count={usage.tokens.output} /></Tile>
    </div>
  );
}

// One row per model, the most tokens first: its bar against the biggest, its tokens, its share and its calls.
function ModelRows({ usage }: { usage: Usage }) {
  const models = [...usage.byModel].sort((a, b) => totalTokens(b.tokens) - totalTokens(a.tokens));
  if (models.length === 0) return null;
  const total = totalTokens(usage.tokens);
  const max = Math.max(...models.map((m) => totalTokens(m.tokens)));
  return (
    <div>
      <h4 className={styles.subtitle}>{t("sessions.usage.models")}</h4>
      <ul className={styles.rows}>
        {models.map((m) => (
          <li key={m.model} className={styles.row}>
            <span className={`${styles.rowName} ${styles.mono}`} title={m.model}>{m.model}</span>
            <KindBar tokens={m.tokens} max={max} />
            <span className={styles.rowFigure}>
              <TokenCount count={totalTokens(m.tokens)} />
              <span className={styles.muted}>{percentText(total ? totalTokens(m.tokens) / total : 0)} · {t("sessions.usage.callsCount", { count: exactTokens(m.calls) })}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// sessions-live FR-33: the run's tags, its models, its top tools and skills, and its prompts, each with its own bar.
function RunDetail({ run }: { run: RunUsage }) {
  const tools = topWithRest(run.tools);
  const skills = topWithRest(run.skills);
  const maxPrompt = Math.max(0, ...run.prompts.map((p) => totalTokens(p.tokens)));
  return (
    <div className={styles.detail}>
      {(!run.settled || run.partial) && (
        <div className={styles.tags}>
          {!run.settled && <span title={t("sessions.usage.provisionalHint")}><Tag>{t("sessions.usage.provisional")}</Tag></span>}
          {run.partial && <span title={t("sessions.usage.partialHint")}><Tag>{t("sessions.usage.partial")}</Tag></span>}
        </div>
      )}
      <Tiles usage={run} />
      <KindBar tokens={run.tokens} />
      <KindLegend tokens={run.tokens} />
      <ModelRows usage={run} />
      <div className={styles.lists}>
        <div>
          <h4 className={styles.subtitle}>{t("sessions.usage.tools")}</h4>
          {tools.shown.length ? (
            <ul className={styles.list}>
              {tools.shown.map((tool) => (
                <li key={tool.name}>
                  <span className={styles.mono}>{tool.name}</span>
                  <span className={styles.muted}>{t("sessions.usage.times", { count: tool.count })}</span>
                </li>
              ))}
              {tools.rest > 0 && <li className={styles.muted}>{tn("sessions.usage.more", tools.rest)}</li>}
            </ul>
          ) : (
            <p className={styles.muted}>{t("sessions.detail.none")}</p>
          )}
        </div>
        <div>
          <h4 className={styles.subtitle}>{t("sessions.usage.skills")}</h4>
          {skills.shown.length ? (
            <ul className={styles.list}>
              {skills.shown.map((skill) => (
                <li key={`${skill.how}:${skill.name}`}>
                  <span className={styles.mono}>{skill.name}</span>
                  <span className={styles.muted}>
                    {t("sessions.usage.times", { count: skill.count })} · {skillHowLabel(skill.how)}
                  </span>
                </li>
              ))}
              {skills.rest > 0 && <li className={styles.muted}>{tn("sessions.usage.more", skills.rest)}</li>}
            </ul>
          ) : (
            <p className={styles.muted}>{t("sessions.detail.none")}</p>
          )}
        </div>
      </div>
      {run.prompts.length > 0 && (
        <div>
          <h4 className={styles.subtitle}>
            {t("sessions.usage.prompts")} <span className={styles.count}>{run.prompts.length}</span>
          </h4>
          {hasDroppedPrompts(run) && <p className={styles.note}>{t("sessions.usage.promptsCut")}</p>}
          <ul className={styles.rows}>
            {run.prompts.map((p, i) => (
              <li key={i} className={styles.row}>
                <span className={styles.rowName}>{p.at ? timeOf(p.at) : t("sessions.facts.unknown")}</span>
                <KindBar tokens={p.tokens} max={maxPrompt} />
                <span className={styles.rowFigure}>
                  <TokenCount count={totalTokens(p.tokens)} />
                  <span className={styles.muted}>{t("sessions.usage.callsCount", { count: exactTokens(p.calls) })}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// One run of the list: a header row (time, request, bar against the biggest run, tokens, share of the session) that unfolds
// into the run's figures; the current run also carries its tools, skills and prompts (sessions-live FR-33, FR-36).
function RunRow({ run, usage, max, sessionTotal, current, isOpenAtFirst, now }: {
  run: SessionRun;
  usage: Usage | null;
  max: number;
  sessionTotal: number;
  current: RunUsage | null;
  isOpenAtFirst: boolean;
  now: number;
}) {
  const [isOpen, setOpen] = useState(isOpenAtFirst);
  const detailId = useId();
  const request = runRequestText(run);
  const total = usage ? totalTokens(usage.tokens) : 0;
  return (
    <li className={styles.run}>
      <button type="button" className={styles.runHead} aria-expanded={isOpen} aria-controls={detailId} onClick={() => setOpen(!isOpen)}>
        <span className={styles.runChevron}>{isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
        <span className={styles.runTime}>{runTimeText(run.since, now)}</span>
        <span className={styles.runRequest} title={request}>{request}</span>
        {usage ? <KindBar tokens={usage.tokens} max={max} /> : <span />}
        <span className={styles.rowFigure}>
          {usage ? <TokenCount count={total} /> : t("sessions.facts.unknown")}
          {usage && <span className={styles.muted}>{percentText(sessionTotal ? total / sessionTotal : 0)}</span>}
        </span>
      </button>
      <div id={detailId} hidden={!isOpen}>
        {current ? (
          <RunDetail run={current} />
        ) : usage ? (
          <div className={styles.detail}>
            <Tiles usage={usage} />
            <KindBar tokens={usage.tokens} />
            <KindLegend tokens={usage.tokens} />
            <ModelRows usage={usage} />
          </div>
        ) : (
          <p className={`${styles.detail} ${styles.muted}`}>{t("sessions.facts.unknown")}</p>
        )}
      </div>
    </li>
  );
}

// sessions-live FR-32 to FR-36: the session's tiles, the split of its four kinds and of its models, then its runs, the latest
// first and unfolded. The export details only the current run (the latest) with tools, skills and prompts (`runUsage`).
export function UsageDashboard({ usage, runs, isRunListCut, runUsage, now }: {
  usage: Usage | null;
  runs: SessionRun[];
  isRunListCut: boolean;
  runUsage: RunUsage | null;
  now: number;
}) {
  const sessionTotal = usage ? totalTokens(usage.tokens) : 0;
  const latestFirst = [...runs].reverse();
  const max = Math.max(0, ...runs.map((r) => (r.usage ? totalTokens(r.usage.tokens) : 0)));
  return (
    <div className={styles.dashboard}>
      {usage && (
        <>
          <Tiles usage={usage} />
          <div>
            <KindBar tokens={usage.tokens} />
            <KindLegend tokens={usage.tokens} />
          </div>
          <ModelRows usage={usage} />
        </>
      )}
      {latestFirst.length > 0 ? (
        <div>
          <h4 className={styles.subtitle}>
            {t("sessions.usage.runs")} <span className={styles.count}>{runs.length}</span>
          </h4>
          {isRunListCut && <p className={styles.note}>{t("sessions.usage.runsCut")}</p>}
          <ul className={styles.runs}>
            {latestFirst.map((r, i) => (
              <RunRow key={r.since} run={r} usage={r.usage} max={max} sessionTotal={sessionTotal} current={i === 0 ? runUsage : null} isOpenAtFirst={i === 0} now={now} />
            ))}
          </ul>
        </div>
      ) : (
        runUsage && (
          <div>
            <h4 className={styles.subtitle}>{t("sessions.usage.currentRun")}</h4>
            <RunDetail run={runUsage} />
          </div>
        )
      )}
    </div>
  );
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
