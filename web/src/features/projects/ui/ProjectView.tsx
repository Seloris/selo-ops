import { useState, type CSSProperties, type ReactNode } from "react";
import { t, tn, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { CommandBox } from "../../../shared/ui/CommandBox.tsx";
import { EmptyState } from "../../../shared/ui/EmptyState.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { BlueprintIcon, BranchIcon, ChevronRightIcon, GaugeIcon, HistoryIcon, NoteIcon, TextFileIcon, WarningIcon } from "../../../shared/ui/icons.tsx";
import { SearchInput } from "../../../shared/ui/SearchInput.tsx";
import { SpecChip, SpecIcon, specColor } from "../../../shared/ui/SpecKind.tsx";
import { StatusDot } from "../../../shared/ui/StatusDot.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import {
  blueprintLists,
  dateOf,
  isOpenBlueprint,
  sheetLists,
  type Blueprint,
  type ProjectOverview,
  type SpecSheet,
} from "../data/projectView.ts";
import { filterBlueprints, hasFilter, monthLabel, periodGroups, sheetChips, type BlueprintFilter, type Period } from "./blueprintList.ts";
import { ChangelogTimeline, type ChangelogState } from "./ChangelogTimeline.tsx";
import { DeltaFigures, DoneSummary, HueChip, InlineStateBar, LiveSessions, ProgressTrack, SectionTitle, StateBar, StateTag, Tiles, type Hue, type LiveItem } from "./ProjectParts.tsx";
import styles from "./ProjectView.module.css";

export const IDEAS_FILE = ".planning/ideas.md";
export const DEBT_FILE = ".planning/technical-debt.md";

// projects FR-08: a group's heading.
function periodLabel(p: Period): string {
  if (p.kind === "thisWeek") return t("projects.blueprints.period.thisWeek");
  if (p.kind === "lastWeek") return t("projects.blueprints.period.lastWeek");
  if (p.kind === "earlierThisMonth") return t("projects.blueprints.period.earlierThisMonth", { month: monthLabel(p.month, { isBare: true }) });
  if (p.kind === "month") return monthLabel(p.month);
  return t("projects.blueprints.period.undated");
}

// projects FR-05 to FR-09, FR-18 and FR-24: one project's view, in place of the cards.
export function ProjectView({
  project: p,
  openPath,
  changelog,
  today,
  liveOf,
  ageOf,
  filter,
  onFilter,
  onBack,
  onOpenFile,
  onAsk,
  onAskSpecs,
  onCopy,
}: {
  project: ProjectOverview;
  // The file open in the panel, marked in the lists.
  openPath: string | null;
  changelog: ChangelogState;
  // The local day, `YYYY-MM-DD`.
  today: string;
  liveOf: (ids: string[]) => LiveItem[];
  // « 3 h 05 » since an ISO date.
  ageOf: (iso: string) => string;
  // projects FR-24: the filters of the blueprints' list, kept in the address.
  filter: BlueprintFilter;
  onFilter: (filter: BlueprintFilter) => void;
  onBack: () => void;
  onOpenFile: (path: string) => void;
  // projects FR-19: opens the questions on the whole project in the panel.
  onAsk: () => void;
  // projects FR-23: opens the questions on all the specs in the panel.
  onAskSpecs: () => void;
  onCopy: (prompt: string) => void;
}) {
  const open = p.blueprints.filter(isOpenBlueprint);
  const { listed, legacy } = blueprintLists(p.blueprints);
  // projects FR-08 and FR-24: the list filtered, then grouped by period. The search's text lives here as it is typed, the
  // address following it: a field fed back from the address loses keys and its caret.
  const [text, setText] = useState(filter.text);
  const current: BlueprintFilter = { ...filter, text };
  const isFiltering = hasFilter(current);
  const shown = filterBlueprints(listed, current);
  const shownLegacy = filterBlueprints(legacy, current);
  const matchCount = shown.length + shownLegacy.length;
  const groups = periodGroups(shown, today);
  const chips = sheetChips(p.sheets, p.blueprints);
  // While a filter holds, each change of it opens every group again.
  const filterKey = isFiltering ? `|${text}|${current.sheets.join(",")}` : "";
  const changeFilter = (next: BlueprintFilter) => {
    setText(next.text);
    onFilter(next);
  };
  const toggleSheet = (key: string) =>
    changeFilter({ ...current, sheets: current.sheets.includes(key) ? current.sheets.filter((k) => k !== key) : [...current.sheets, key] });
  const { pages, domains } = sheetLists(p.sheets);
  const frs = p.sheets.reduce((n, s) => n + s.frCount, 0);
  const brs = p.sheets.reduce((n, s) => n + s.brCount, 0);
  const unknown = t("projects.view.unknown");
  const rowClass = (path: string) => `${styles.row} ${openPath === path ? styles.selected : ""}`;

  // One line per blueprint, its cells in columns shared by every row.
  const blueprintRow = (b: Blueprint) => (
    <li key={b.name}>
      <button type="button" className={`${rowClass(b.file)} ${styles.bpRow}`} onClick={() => onOpenFile(b.file)} aria-current={openPath === b.file || undefined}>
        <span className={styles.date}>{dateOf(b) ?? ""}</span>
        <span className={styles.rowTitle} title={b.title}>
          <SpecChip kind="blueprint" />
          <span className={styles.ellipsis}>{b.title}</span>
          {b.worktreeBranch && <Tag icon={<BranchIcon />}>{t("projects.worktree", { branch: b.worktreeBranch })}</Tag>}
        </span>
        <span className={styles.state}>
          <StateTag state={b.state} />
        </span>
        <span className={`${styles.sheets} ${styles.ellipsis}`} title={b.sheets.join(" · ")}>
          {b.sheets.join(" · ")}
        </span>
        <span className={styles.deltaCell}>
          <DeltaFigures delta={b.delta} />
        </span>
        <span className={styles.trackCell}>
          {b.state === "done" ? <DoneSummary blueprint={b} /> : <ProgressTrack blueprint={b} />}
        </span>
      </button>
    </li>
  );

  // One line per sheet; the open blueprints touching it, when any, on a second line.
  const sheetRow = (s: SpecSheet) => {
    return (
      <li key={s.file}>
        <button type="button" className={`${rowClass(s.file)} ${styles.sheetRow}`} onClick={() => onOpenFile(s.file)} aria-current={openPath === s.file || undefined}>
          <span className={styles.rowTitle} title={s.title}>
            <SpecChip kind={s.kind === "page" ? "page" : "domain"} />
            <span className={styles.ellipsis}>{s.title}</span>
            {s.route && <span className={styles.route}>{s.route}</span>}
            {s.isStub && <Tag>{t("projects.specs.stub")}</Tag>}
          </span>
          <span className={styles.counts}>{t("projects.specs.counts", { fr: s.frCount, br: s.brCount })}</span>
          <span className={styles.questions}>{s.questionCount > 0 && tn("projects.specs.questions", s.questionCount)}</span>
          <span className={styles.commit} title={s.lastCommit?.subject}>
            {s.lastCommit && t("projects.specs.age", { age: ageOf(s.lastCommit.at) })}
          </span>
          {s.openBlueprints.length > 0 && (
            <span className={styles.touching}>
              {p.blueprints
                .filter((b) => s.openBlueprints.includes(b.name))
                .map((b) => (
                  <StateTag key={b.name} state={b.state} />
                ))}
              <span>{s.openBlueprints.join(" · ")}</span>
            </span>
          )}
        </button>
      </li>
    );
  };

  // projects FR-08 and FR-09: the columns named once above the rows; hidden for assistive tech, each cell carrying its own label.
  const headRow = (keys: MessageKey[], gridClass: string | undefined, endKeys: MessageKey[] = []) => (
    <div className={`${styles.headRow} ${gridClass ?? ""}`} aria-hidden="true">
      {keys.map((k) => (
        <span key={k} className={endKeys.includes(k) ? styles.end : undefined}>
          {t(k)}
        </span>
      ))}
    </div>
  );

  const noteRow = (path: string, icon: ReactNode, hue: Hue, title: string, count: number, empty: string) => (
    <li key={path}>
      <button type="button" className={`${rowClass(path)} ${styles.sheetRow}`} onClick={() => onOpenFile(path)} aria-current={openPath === path || undefined}>
        <span className={styles.rowTitle}>
          <HueChip icon={icon} hue={hue} />
          <span className={styles.ellipsis}>{title}</span>
        </span>
        <span className={styles.noteCount}>{count > 0 ? tn("projects.specs.items", count) : empty}</span>
      </button>
    </li>
  );

  return (
    <div className={styles.view}>
      <div className={styles.head}>
        <div className={styles.titleLine}>
          <Button size="sm" onClick={onBack}>
            ← {t("projects.view.back")}
          </Button>
          <h2 className={styles.name}>{p.name}</h2>
          <span className={styles.askButton}>
            <Button size="sm" onClick={onAsk}>
              {t("projects.ask.open")}
            </Button>
          </span>
        </div>
        {/* Each fact a label and its value, side by side, wrapping as a whole. */}
        <dl className={styles.facts}>
          <div>
            <dt>{t("projects.view.folder")}</dt>
            <dd className={styles.mono}>{p.root}</dd>
          </div>
          <div>
            <dt>{t("projects.view.branch")}</dt>
            <dd className={styles.mono}>{p.branch ?? unknown}</dd>
          </div>
          <div>
            <dt>{t("projects.view.baseBranch")}</dt>
            <dd className={styles.mono}>{p.baseBranch ?? unknown}</dd>
          </div>
          <div>
            <dt>{t("projects.view.selo")}</dt>
            <dd className={styles.mono}>{p.seloVersion ?? unknown}</dd>
          </div>
          <div>
            <dt>{t("projects.view.git")}</dt>
            <dd>
              {tn("projects.card.changed", p.changedCount ?? 0)} · {tn("projects.card.unpushed", p.unpushedCount ?? 0)}
            </dd>
          </div>
          <div>
            <dt>{t("projects.view.worktrees")}</dt>
            <dd>
              {p.worktrees.length === 0 ? (
                t("projects.view.noWorktree")
              ) : (
                <ul className={styles.worktrees}>
                  {p.worktrees.map((w) => (
                    <li key={w.root}>
                      <span className={styles.mono}>{w.branch ?? unknown}</span>
                      {w.aheadCount !== null && <span className={styles.muted}> · {tn("projects.view.ahead", w.aheadCount)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          {/* projects FR-17: each slot's run, its URLs live links only while it runs. */}
          <div>
            <dt>{t("projects.view.slots")}</dt>
            <dd>
              {p.slots.length === 0 ? (
                t("projects.view.noSlot")
              ) : (
                <ul className={styles.slots}>
                  {p.slots.map((s) => (
                    <li key={s.number}>
                      <StatusDot tone={s.isRunning ? "pulse" : "off"} />
                      <span>{t("projects.view.slot", { number: s.number })}</span>
                      <span className={styles.mono}>{s.branch ?? unknown}</span>
                      <span className={styles.muted}>
                        {s.isRunning
                          ? s.startedAt
                            ? t("projects.view.slotRunningFor", { age: ageOf(s.startedAt) })
                            : t("projects.view.slotRunning")
                          : t("projects.view.slotStopped")}
                      </span>
                      {s.components.map((c) => (
                        <span key={c.name} className={s.isRunning ? undefined : styles.muted}>
                          {c.name}
                          {c.mode !== "dev" && ` (${c.mode})`}{" "}
                          {s.isRunning ? (
                            <a className={styles.mono} href={c.url} target="_blank" rel="noreferrer">
                              {c.url}
                            </a>
                          ) : (
                            <span className={styles.mono}>{c.url}</span>
                          )}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
        {p.error && (
          <ErrorMessage>
            {t("projects.view.error")} : {p.error}
          </ErrorMessage>
        )}
        <LiveSessions items={liveOf(p.sessionIds)} />
      </div>

      <Tiles
        tiles={[
          { label: t("projects.tiles.closed"), value: `${p.blueprints.length - open.length} / ${p.blueprints.length}`, kind: "blueprint" },
          { label: t("projects.tiles.pages"), value: pages.length, kind: "page" },
          { label: t("projects.tiles.domains"), value: domains.length, kind: "domain" },
          { label: t("projects.tiles.frs"), value: frs },
          { label: t("projects.tiles.brs"), value: brs },
          { label: t("projects.tiles.ideas"), value: p.ideaCount },
          { label: t("projects.tiles.debt"), value: p.debtCount },
        ]}
      />

      <section className={styles.section}>
        <SectionTitle icon={<GaugeIcon />} hue="progress" title={t("projects.progress.title")} count={open.length} />
        {p.blueprints.length === 0 ? (
          <EmptyState>{t("projects.empty.blueprints")}</EmptyState>
        ) : (
          <>
            <StateBar blueprints={p.blueprints} withLegend />
            {open.length === 0 ? (
              <EmptyState>{t("projects.empty.open")}</EmptyState>
            ) : (
              <ul className={styles.openList}>
                {open.map((b) => (
                  <li key={b.name} className={styles.openItem}>
                    <div className={styles.openHead}>
                      <button type="button" className={styles.openTitle} onClick={() => onOpenFile(b.file)}>
                        <SpecChip kind="blueprint" />
                        {b.title}
                      </button>
                      <span className={styles.rowMeta}>
                        <StateTag state={b.state} />
                        {b.worktreeBranch && <Tag icon={<BranchIcon />}>{t("projects.worktree", { branch: b.worktreeBranch })}</Tag>}
                      </span>
                      <ProgressTrack blueprint={b} />
                    </div>
                    <LiveSessions items={liveOf(b.sessionIds)} />
                    {b.nextPrompt && <CommandBox command={b.nextPrompt} copyLabel={t("projects.next.copy")} onCopy={() => onCopy(b.nextPrompt ?? "")} />}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className={styles.section}>
        <SectionTitle icon={<BlueprintIcon />} hue="blueprints" title={t("projects.blueprints.title")} count={listed.length} />
        {p.blueprints.length === 0 ? (
          <EmptyState>{t("projects.empty.blueprints")}</EmptyState>
        ) : (
          <>
            <div className={styles.filters}>
              <div className={styles.searchLine}>
                <div className={styles.search}>
                  <SearchInput
                    aria-label={t("projects.blueprints.search")}
                    placeholder={t("projects.blueprints.search")}
                    value={text}
                    onChange={(event) => changeFilter({ ...current, text: event.target.value })}
                  />
                </div>
                {/* Mounted even when empty, so that its first count is read out. */}
                <span className={styles.matches} aria-live="polite">
                  {isFiltering && t("projects.blueprints.matches", { count: matchCount, total: p.blueprints.length })}
                </span>
                {isFiltering && (
                  <Button size="sm" variant="ghost" onClick={() => changeFilter({ text: "", sheets: [] })}>
                    {t("projects.blueprints.clear")}
                  </Button>
                )}
              </div>
              {chips.length > 0 && (
                <div className={styles.chips} role="group" aria-label={t("projects.blueprints.sheetFilter")}>
                  {chips.map((c) => {
                    const kind = c.sheet.kind === "page" ? "page" : "domain";
                    return (
                      <button
                        key={c.key}
                        type="button"
                        className={styles.chip}
                        style={{ "--spec": specColor(kind) } as CSSProperties}
                        aria-pressed={current.sheets.includes(c.key)}
                        title={tn("projects.blueprints.chipCount", c.count, { title: c.sheet.title })}
                        onClick={() => toggleSheet(c.key)}
                      >
                        <SpecIcon kind={kind} />
                        {c.key}
                        <span className={styles.chipCount}>{c.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {matchCount === 0 ? (
              <EmptyState>{t("projects.blueprints.noMatch")}</EmptyState>
            ) : (
              headRow(
                ["projects.columns.date", "projects.columns.blueprint", "projects.columns.state", "projects.columns.sheets", "projects.columns.delta", "projects.columns.progress"],
                styles.bpRow,
                ["projects.columns.delta"],
              )
            )}
            {groups.map((g) => (
              // While a filter holds, every group left opens: its key changes with the filter, so each one starts again from `open`.
              <details key={`${g.key}${filterKey}`} className={styles.period} open={isFiltering || g.isOpen}>
                <summary className={styles.periodHead}>
                  <ChevronRightIcon />
                  <span className={styles.periodName}>{periodLabel(g.period)}</span>
                  <span className={styles.periodCount}>{g.blueprints.length}</span>
                  <InlineStateBar blueprints={g.blueprints} />
                </summary>
                <ul className={styles.rows}>{g.blueprints.map(blueprintRow)}</ul>
              </details>
            ))}
            {shownLegacy.length > 0 && (
              <details key={`legacy${filterKey}`} className={styles.legacy} open={isFiltering}>
                <summary>{tn("projects.blueprints.legacy", shownLegacy.length)}</summary>
                <ul className={styles.rows}>{shownLegacy.map(blueprintRow)}</ul>
              </details>
            )}
          </>
        )}
      </section>

      <section className={styles.section}>
        <SectionTitle icon={<HistoryIcon />} hue="changelog" title={t("projects.changelog.title")} />
        <ChangelogTimeline
          changelog={changelog}
          today={today}
          blueprintFiles={new Set(p.blueprints.map((b) => b.file))}
          openPath={openPath}
          onOpenFile={onOpenFile}
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <SectionTitle icon={<TextFileIcon />} hue="specs" title={t("projects.specs.title")} count={p.sheets.length} />
          <Button size="sm" aria-label={t("projects.ask.specsLabel")} onClick={onAskSpecs}>
            {t("projects.ask.open")}
          </Button>
        </div>
        {p.sheets.length === 0 && <EmptyState>{t("projects.empty.specs")}</EmptyState>}
        {p.sheets.length > 0 && headRow(["projects.columns.sheet", "projects.columns.counts", "projects.columns.questions", "projects.columns.lastCommit"], styles.sheetRow)}
        {pages.length > 0 && (
          <>
            <h4 className={styles.group}>
              <SpecChip kind="page" />
              {t("projects.specs.pages")}
            </h4>
            <ul className={styles.rows}>{pages.map(sheetRow)}</ul>
          </>
        )}
        {domains.length > 0 && (
          <>
            <h4 className={styles.group}>
              <SpecChip kind="domain" />
              {t("projects.specs.domains")}
            </h4>
            <ul className={styles.rows}>{domains.map(sheetRow)}</ul>
          </>
        )}
        <ul className={styles.rows}>
          {noteRow(IDEAS_FILE, <NoteIcon />, "ideas", t("projects.specs.ideas"), p.ideaCount, t("projects.empty.ideas"))}
          {noteRow(DEBT_FILE, <WarningIcon />, "debt", t("projects.specs.debt"), p.debtCount, t("projects.empty.debt"))}
        </ul>
      </section>
    </div>
  );
}
