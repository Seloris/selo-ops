import { useId, useState } from "react";
import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { ChevronDownIcon, ChevronRightIcon } from "../../../shared/ui/icons.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import { exactTokens, formatTokens, hasDroppedPrompts, runRequestText, runTimeText, skillHowLabel, TOKEN_KINDS, topWithRest, totalTokens, type RunUsage, type SessionRun, type Tokens, type Usage } from "./usage.ts";
import styles from "./UsageParts.module.css";

// sessions-live FR-32 to FR-35: what a session or its current run consumed, as the export gives it (`session` BR-18, BR-19).

// An abbreviated count, the exact one in its tooltip (sessions-live FR-35).
export function TokenCount({ count }: { count: number }) {
  return <span title={t("sessions.usage.exact", { count: exactTokens(count) })}>{formatTokens(count)}</span>;
}

// The calls and the four kinds in their own columns, the total first, then one row per model, the most tokens first.
export function UsageTable({ usage }: { usage: Usage }) {
  const rows: { label: string; calls: number; tokens: Tokens; isTotal: boolean }[] = [
    { label: t("sessions.usage.total"), calls: usage.calls, tokens: usage.tokens, isTotal: true },
    ...[...usage.byModel]
      .sort((a, b) => totalTokens(b.tokens) - totalTokens(a.tokens))
      .map((m) => ({ label: m.model, calls: m.calls, tokens: m.tokens, isTotal: false })),
  ];
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t("sessions.usage.model")}</th>
            <th scope="col">{t("sessions.usage.calls")}</th>
            {TOKEN_KINDS.map((kind) => (
              <th key={kind} scope="col">{t(`sessions.usage.kind.${kind}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.isTotal ? styles.total : undefined}>
              <th scope="row" className={r.isTotal ? undefined : styles.mono}>{r.label}</th>
              <td>{exactTokens(r.calls)}</td>
              {TOKEN_KINDS.map((kind) => (
                <td key={kind}><TokenCount count={r.tokens[kind]} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// sessions-live FR-33, FR-34: the current run's figures, its tags, its top tools and skills, and its prompts, folded.
export function RunUsageView({ run }: { run: RunUsage }) {
  const tools = topWithRest(run.tools);
  const skills = topWithRest(run.skills);
  const [isPromptsOpen, setPromptsOpen] = useState(false);
  const promptsId = useId();
  return (
    <div className={styles.run}>
      {(!run.settled || run.partial) && (
        <div className={styles.tags}>
          {!run.settled && <span title={t("sessions.usage.provisionalHint")}><Tag>{t("sessions.usage.provisional")}</Tag></span>}
          {run.partial && <span title={t("sessions.usage.partialHint")}><Tag>{t("sessions.usage.partial")}</Tag></span>}
        </div>
      )}
      <UsageTable usage={run} />
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
          <button type="button" className={styles.toggle} aria-expanded={isPromptsOpen} aria-controls={promptsId} onClick={() => setPromptsOpen(!isPromptsOpen)}>
            {isPromptsOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
            {t("sessions.usage.prompts")}
            <span className={styles.count}>{run.prompts.length}</span>
          </button>
          <div id={promptsId} hidden={!isPromptsOpen}>
            {hasDroppedPrompts(run) && <p className={styles.note}>{t("sessions.usage.promptsCut")}</p>}
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t("sessions.usage.time")}</th>
                    <th scope="col">{t("sessions.usage.calls")}</th>
                    <th scope="col">{t("sessions.usage.tokens")}</th>
                  </tr>
                </thead>
                <tbody>
                  {run.prompts.map((p, i) => (
                    <tr key={i}>
                      <th scope="row">{p.at ? timeOf(p.at) : t("sessions.facts.unknown")}</th>
                      <td>{exactTokens(p.calls)}</td>
                      <td><TokenCount count={totalTokens(p.tokens)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// sessions-live FR-36: every main run the export keeps, oldest first, folded; a free prompt opens a run of its own.
export function SessionRunsView({ runs, isCut, now }: { runs: SessionRun[]; isCut: boolean; now: number }) {
  const [isOpen, setOpen] = useState(false);
  const listId = useId();
  const unknown = t("sessions.facts.unknown");
  return (
    <div>
      <button type="button" className={styles.toggle} aria-expanded={isOpen} aria-controls={listId} onClick={() => setOpen(!isOpen)}>
        {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
        {t("sessions.usage.runs")}
        <span className={styles.count}>{runs.length}</span>
      </button>
      <div id={listId} hidden={!isOpen}>
        {isCut && <p className={styles.note}>{t("sessions.usage.runsCut")}</p>}
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("sessions.usage.time")}</th>
                <th scope="col" className={styles.request}>{t("sessions.usage.request")}</th>
                <th scope="col">{t("sessions.usage.calls")}</th>
                <th scope="col">{t("sessions.usage.tokens")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r, i) => {
                const request = runRequestText(r);
                return (
                  <tr key={i}>
                    <th scope="row">{runTimeText(r.since, now)}</th>
                    <td className={styles.request} title={request}>{request}</td>
                    <td>{r.usage ? exactTokens(r.usage.calls) : unknown}</td>
                    <td>{r.usage ? <TokenCount count={totalTokens(r.usage.tokens)} /> : unknown}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
