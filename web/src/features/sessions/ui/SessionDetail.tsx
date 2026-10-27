import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { CommandBox } from "../../../shared/ui/CommandBox.tsx";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { Fragment, useId, useState, type CSSProperties, type ReactNode } from "react";
import { ArchiveIcon, BranchIcon,ChevronDownIcon, ChevronRightIcon, CloseIcon, CollapseIcon, CommitIcon, DoorIcon, ExpandIcon, FolderIcon, GaugeIcon, HourglassIcon, NoteIcon, TrailIcon, OpenIcon, PopOutIcon, PromptIcon, RobotIcon, SlidersIcon, UnarchiveIcon, WarningIcon } from "../../../shared/ui/icons.tsx";
import { StatusDot, type DotTone } from "../../../shared/ui/StatusDot.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import { ageMs, isTodo, type Session } from "../data/sessionView.ts";
import type { DetailSection } from "./detailSections.ts";
import type { FileSummary } from "../data/useFileSummaryQuery.ts";
import { fileTotals } from "./fileTotals.ts";
import { FileTree, LineCounts } from "./FileTree.tsx";
import { currentRunSince, earlierRuns, hasTrail, lineColor, skillColor, trailChapters, trailLines, trailPath, type Chapter, type TrailLine, type TrailRun } from "./trail.ts";
import { runRequestText, runTimeText, totalTokens, usageSummary } from "./usage.ts";
import { TokenCount, UsageDashboard } from "./UsageParts.tsx";
import { AwaitedIcon, NoteText, PluginWarning, StateLabel } from "./SessionBits.tsx";
import type { SessionActions } from "./SessionList.tsx";
import { FlagButton, NotifySwitch } from "./FlagControls.tsx";
import { age, ageDisplay, awaitedOf, blockerHint, blockerLabel, blockerTone, calmText, closeText, createdText, laneColor, nextCommands, requestText, stageText, toneOf, workLabel, shownBlockers, stateLabel, writtenByText } from "./sessionText.ts";
import styles from "./SessionDetail.module.css";
import extras from "./NextAction.module.css";

// sessions-live FR-19 to FR-23: everything the export knows of one session, and its actions. A session outside selo
// (sessions-live FR-30) shows no recap, commits, subagents, files modified nor blueprint: only the export gives them.
export function SessionDetail({
  session: s,
  projectName,
  now,
  isPluginOutdated,
  foldedSections,
  actions,
  isFullscreen,
  fileSummary,
  earlierTrails,
  onClose,
  onToggleFullscreen,
  onToggleSection,
  onOpenFiles,
}: {
  session: Session;
  projectName: string;
  now: number;
  isPluginOutdated: boolean;
  foldedSections: readonly DetailSection[];
  actions: SessionActions;
  isFullscreen: boolean;
  // Each touched file's status and lines, once git is read (sessions-live FR-54).
  fileSummary: FileSummary | undefined;
  // The earlier prompts' history, once read (sessions-live FR-41).
  earlierTrails: readonly TrailRun[] | undefined;
  onClose: () => void;
  onToggleFullscreen: () => void;
  onToggleSection: (section: DetailSection) => void;
  // Opens the « Fichiers modifiés » window on this file, or on the first one (sessions-live FR-55).
  onOpenFiles: (file: string | null) => void;
}) {
  // sessions-live FR-41: the chapters the person folded or unfolded, by their start; a chapter not chosen is open
  // while it is the last one of its prompt, so a new chapter folds the one before it.
  const [chapterChoices, setChapterChoices] = useState<ReadonlyMap<string, boolean>>(new Map());
  const toggleChapter = (at: string, isOpen: boolean) => setChapterChoices((choices) => new Map(choices).set(at, !isOpen));
  // The earlier prompts the person unfolded, by their start: folded until then.
  const [runChoices, setRunChoices] = useState<ReadonlyMap<string, boolean>>(new Map());
  const toggleRun = (id: string, isOpen: boolean) => setRunChoices((choices) => new Map(choices).set(id, !isOpen));
  const awaited = awaitedOf(s);
  const blockers = shownBlockers(s);
  const tag = ageDisplay(s, now);
  const unknown = t("sessions.facts.unknown");
  // An empty section says it all in its heading: it neither folds nor unfolds.
  const fold = (section: DetailSection, isEmpty = false) => ({ isEmpty, isFolded: foldedSections.includes(section), onToggle: () => onToggleSection(section) });
  const awaitedSection = (
    <Section icon={<HourglassIcon />} hue={!awaited || !isTodo(s) ? "muted" : awaited.kind === "error" ? "danger" : "warn"} title={t("sessions.detail.awaited")} summary={awaited ? `${awaited.label} · ${awaited.text}` : calmText(s)} {...fold("awaited", !awaited)}>
      {awaited && (
        <div className={`${styles.ask} ${!isTodo(s) ? styles.neutral : awaited.kind === "error" ? styles.danger : styles.warn}`}>
          <AwaitedIcon kind={awaited.kind} isMuted={!isTodo(s)} />
          <div>
            <b>{awaited.label}</b>
            <p className={`${styles.pre} ${awaited.isCode ? styles.mono : ""}`}>{awaited.full}</p>
          </div>
        </div>
      )}
    </Section>
  );
  // sessions-live FR-21, FR-48: the resume prompt, then the next steps of the done footer.
  const next = nextCommands(s);
  const firstNext = next[0];
  const nextSection = firstNext && (
    <Section icon={<PromptIcon />} hue="next" title={t("sessions.actions.next")} summary={firstNext.command} {...fold("next")}>
      <ul className={styles.nextSteps}>
        {next.map(({ summary, command }) => (
          <li key={command}>
            {summary && <p className={styles.muted}>{summary}</p>}
            <CommandBox command={command} copyLabel={t("sessions.actions.copy")} onCopy={() => actions.onCopyNext(s, command)} />
          </li>
        ))}
      </ul>
    </Section>
  );
  const closeSection = (
    <Section icon={<DoorIcon />} hue="close" title={t("sessions.detail.canClose")} summary={closeText(s)} {...fold("close", s.isOutsideSelo || blockers.length === 0)}>
      {blockers.length > 0 && (
        <>
          <div className={`${styles.verdict} ${styles.neutral}`}>
            <WarningIcon />
            <b>{t("sessions.close.notYet")}</b>
            <span className={styles.muted}>{tn("sessions.close.count", blockers.length)}</span>
          </div>
          <ul className={styles.blockers}>
            {blockers.map((b) => (
              <li key={b}>
                <StatusDot tone={blockerTone(b)} />
                <div>
                  <b>{blockerLabel(b)}</b>
                  <p className={styles.muted}>{blockerHint(b)}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
  const recapSection = !s.isOutsideSelo && (s.recap || s.commits.length > 0) && (
    <Section icon={<CommitIcon />} hue="recap" count={s.commits.length} title={t("sessions.detail.recap")} summary={s.recap} {...fold("recap")}>
      {s.recap && <p>{s.recap}</p>}
      {s.commits.length > 0 && (
        <ul className={styles.lines}>
          {s.commits.map((c) => (
            <li key={c.sha}>
              <span className={styles.hash}>{c.sha}</span>
              <span className={styles.line}>{c.subject}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
  // sessions-live FR-41: absent outside selo and when the current run has no history. A past wait reads as open; past work is
  // muted; the last line keeps the session's closed or archived state, so it never pulses then.
  const isSessionOver = s.isClosed || s.isArchived;
  // An earlier prompt's run is over: its last line keeps its own state, never the session's closed or archived one.
  const toned = (lines: TrailLine[], isCurrentRun: boolean) =>
    lines.map((l, i, all) => {
      const isLast = isCurrentRun && i === all.length - 1;
      const tone: DotTone = l.isPastWork ? "idle" : toneOf({ ...s, state: l.entry.phase, isClosed: isLast && s.isClosed, isArchived: isLast && s.isArchived });
      return { ...l, tone };
    });
  const trail = toned(trailLines(s.trail, s.mode), true);
  const { chapters, isRunning, durationText: runDuration, waitingText: runWaiting } = trailChapters(trail, s.subagents, now, isSessionOver);
  const earlier = earlierRuns(s, earlierTrails).map((run) => ({ run, ...trailChapters(toned(trailLines(run.trail, run.mode), false), run.subagents, now, true) }));
  const path = trailPath(chapters);
  const lastChapter = chapters[chapters.length - 1];
  const lastLine = trail[trail.length - 1];
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR");
  // The time to the second; narrow, the minute alone and the second on hover.
  const when = (iso: string) => {
    const full = timeOf(iso);
    return (
      <span className={styles.when} title={full}>
        {full.slice(0, 5)}
        <span className={styles.sec}>{full.slice(5)}</span>
      </span>
    );
  };
  const stateWords = (state: Session["state"]) => stateLabel({ ...s, state }).toLowerCase();
  // Oldest first, the newest near the present: a chapter's line, then, unfolded, its passages and subagents; the state's
  // badge on the current run's last chapter only.
  const chapterItems = (list: Chapter<(typeof trail)[number]>[], isCurrentRun: boolean) =>
    list.map((c, ci) => {
          const last = c.lines[c.lines.length - 1] as (typeof trail)[number];
          const isLast = ci === list.length - 1;
          const canOpen = c.items.length > 1;
          const isOpen = canOpen && (chapterChoices.get(c.at) ?? isLast);
          const extras = [c.agents.length > 0 && tn("sessions.trail.agents", c.agents.length), c.roundTrips > 0 && tn("sessions.trail.roundTrips", c.roundTrips)].filter(Boolean).join(" · ");
          const row = (
            <>
              {when(c.at)}
              <span className={styles.what}>
                {c.isFree ? <span className={styles.free}>{t("sessions.lane.free")}</span> : <span className={styles.skill}>{last.entry.skill}</span>}
                {last.stepText && <span className={styles.step}>{last.stepText}</span>}
                {extras && <span className={styles.extras}>{extras}</span>}
                {isLast && isCurrentRun && <StateLabel session={{ ...s, state: last.entry.phase }} />}
              </span>
              <span className={`${styles.how} ${c.isLive ? styles.live : ""}`}>
                <span>{c.durationText}</span>
                {c.waitingText && <span className={styles.warnText}>{` · ${t("sessions.trail.waitingIn", { text: c.waitingText })}`}</span>}
              </span>
              <span className={styles.foldc} aria-hidden="true">
                {canOpen && (isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />)}
              </span>
            </>
          );
          return (
            <li key={c.at} className={`${styles.chapter} ${c.isLive ? styles.now : ""}`} style={{ "--lane": c.isFree ? "var(--lane-free)" : lineColor(last) } as CSSProperties}>
              {canOpen ? (
                <button type="button" className={styles.chapterRow} aria-expanded={isOpen} onClick={() => toggleChapter(c.at, isOpen)}>
                  {row}
                </button>
              ) : (
                <div className={styles.chapterRow}>{row}</div>
              )}
              {isOpen && (
                <ol className={styles.passages}>
                  {c.items.map((item, i) => {
                    if (item.kind === "passage") {
                      const isWait = item.line.tone === "warn" || item.line.tone === "danger";
                      return (
                        <li key={`${i}|${item.at}`} className={`${styles.passage} ${isWait ? `${styles.wait} ${styles[`tone-${item.line.tone}`]}` : ""}`}>
                          {when(item.at)}
                          <span className={styles.what}>{item.line.entry.phase === "working" ? (item.line.entry.substep ?? stateWords("working")) : stateWords(item.line.entry.phase)}</span>
                          <span className={styles.how}>
                            <span>{item.durationText}</span>
                          </span>
                        </li>
                      );
                    }
                    const { agent, parts, label, durationText } = item.agent;
                    const isLive = agent.state === "working" && !isSessionOver;
                    const end = agent.state === "job-done" || agent.state === "turn-ended" ? t("sessions.trail.ended") : stateWords(agent.state);
                    return (
                      <li key={`${i}|${item.at}`} className={styles.passage}>
                        {when(item.at)}
                        <span className={styles.what}>
                          <span aria-hidden="true">{"↳ "}</span>
                          {parts ? (
                            <>
                              <b>{parts.lead.replace(/\s*·\s*$/, "")}</b>
                              {" · "}
                              <span style={{ color: skillColor(parts.skill) }}>{parts.skill}</span>
                              {parts.rest}
                            </>
                          ) : (
                            <b>{label}</b>
                          )}
                        </span>
                        <span className={`${styles.how} ${isLive ? styles.live : ""}`}>
                          <span>{durationText}</span>
                          {!isLive && <span>{` · ${end}`}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
    });
  const trailSection = hasTrail(s) && lastChapter && lastLine && (
    <Section
      icon={<TrailIcon />}
      hue="trail"
      count={[chapters, ...earlier.map((r) => r.chapters)].flat().reduce((n, c) => n + 1 + c.agents.length, 0)}
      title={t("sessions.detail.trail")}
      aside={
        <>
          {runDuration}
          {runWaiting && <span className={styles.warnText}>{` · ${runWaiting}`}</span>}
        </>
      }
      summary={
        <span className={styles.path}>
          {path.map((p, i) =>
            i < path.length - 1 ? (
              <Fragment key={i}>
                <span className={styles.pathSkill} style={{ color: p.color }}>
                  {p.label}
                </span>
                <span className={styles.sep} aria-hidden="true">
                  ›
                </span>
              </Fragment>
            ) : (
              <span key={i} className={`${styles.cur} ${styles[`tone-${lastLine.tone}`]}`}>
                {p.label}
                {stageText(lastLine.entry) && ` · ${stageText(lastLine.entry)}`}
              </span>
            ),
          )}
        </span>
      }
      {...fold("trail")}
    >
      <ol className={styles.chapters}>
        {earlier.map(({ run, chapters: runChapters, durationText }) => {
          const isOpen = runChoices.get(run.since) ?? false;
          return (
            <li key={run.since} className={styles.prompt}>
              <button type="button" className={styles.promptRow} aria-expanded={isOpen} onClick={() => toggleRun(run.since, isOpen)}>
                <span className={styles.when}>{runTimeText(run.since, now)}</span>
                <span className={styles.promptText} title={runRequestText(run)}>
                  {runRequestText(run)}
                </span>
                <span className={styles.how}>
                  <span>{durationText}</span>
                </span>
                <span className={styles.foldc} aria-hidden="true">
                  {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
                </span>
              </button>
              {isOpen && (
                <ol className={styles.chapters}>
                  {run.isTrailCut && <li className={styles.cut}>{t("sessions.trail.cut")}</li>}
                  {chapterItems(runChapters, false)}
                </ol>
              )}
            </li>
          );
        })}
        {earlier.length > 0 && (
          <li className={styles.prompt}>
            <div className={styles.promptRow}>
              <span className={styles.when}>{runTimeText(currentRunSince(s) ?? lastChapter.at, now)}</span>
              <span className={styles.promptText} title={requestText(s)}>
                {requestText(s)}
              </span>
              <span className={styles.how}>
                <span>{t("sessions.trail.currentPrompt")}</span>
              </span>
              <span className={styles.foldc} />
            </div>
          </li>
        )}
        {s.isTrailCut && <li className={styles.cut}>{t("sessions.trail.cut")}</li>}
        {chapterItems(chapters, true)}
        {isRunning && (
          <li className={styles.nowLine}>
            <StatusDot tone={lastLine.tone} />
            {t("sessions.trail.now")}
            <span className={styles.nowTime}>{` · ${timeOf(new Date(now).toISOString())}`}</span>
          </li>
        )}
      </ol>
    </Section>
  );
  const agentsSection = !s.isOutsideSelo && (
    <Section icon={<RobotIcon />} hue="agents" count={s.subagents.length} title={t("sessions.detail.subagents")} summary={s.subagents.length ? [...new Set(s.subagents.map((a) => a.type))].join(" · ") : t("sessions.detail.none")} {...fold("agents", s.subagents.length === 0)}>
      <ul className={styles.lines}>
        {s.subagents.map((a, i) => (
          <li key={i}>
            <span className={styles.hash}>{a.type}</span>
            <span className={styles.line}>{a.task ?? ""}</span>
            <span className={styles.status}>
              {stateLabel({ ...s, state: a.state })} · {a.model ?? unknown} ·{" "}
              {a.usage ? <TokenCount count={totalTokens(a.usage.tokens)} /> : unknown}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
  const usageSection = (
    <Section icon={<GaugeIcon />} hue="usage" title={t("sessions.detail.usage")} summary={s.usage ? usageSummary(s.usage) : unknown} {...fold("usage")}>
      {s.usage || s.runs.length > 0 || s.runUsage ? (
        <UsageDashboard usage={s.usage} runs={s.runs} isRunListCut={s.isRunListCut} runUsage={s.runUsage} now={now} />
      ) : (
        <p className={styles.muted}>{unknown}</p>
      )}
    </Section>
  );
  const fileStats = fileSummary?.isAvailable ? fileSummary.files : null;
  const totals = fileStats ? fileTotals(fileStats) : null;
  const filesFold = fold("files", s.touchedFiles.length === 0);
  const filesSection = !s.isOutsideSelo && (
    <Section
      icon={<FolderIcon />}
      hue="files"
      count={s.touchedFiles.length}
      title={t("sessions.detail.files")}
      summary={s.touchedFiles.length ? s.touchedFiles.map((f) => f.split("/").pop()).join(" · ") : t("sessions.detail.none")}
      aside={
        totals && !filesFold.isFolded ? (
          <>
            <LineCounts added={totals.added} removed={totals.removed} />
            {totals.uncommitted > 0 && ` · ${tn("sessions.files.uncommitted", totals.uncommitted)}`}
          </>
        ) : null
      }
      {...filesFold}
    >
      <div className={styles.openFiles}>
        <Button size="sm" onClick={() => onOpenFiles(null)}>
          <PopOutIcon />
          {t("sessions.files.explore")}
        </Button>
        <span className={styles.muted}>{t("sessions.files.hint")}</span>
      </div>
      <FileTree paths={s.touchedFiles} selected={null} onSelect={(file) => onOpenFiles(file)} stats={fileStats ? new Map(fileStats.map((f) => [f.file, f])) : undefined} />
    </Section>
  );
  const settingsSection = (
    <Section icon={<SlidersIcon />} hue="muted" title={t("sessions.detail.settings")} summary={[s.model, s.effort, s.permissionMode].filter(Boolean).join(" · ") || unknown} {...fold("settings")}>
      <div className={styles.kv}>
        <span className={styles.key}>{t("sessions.detail.model")}</span>
        <span>{s.model ?? unknown}</span>
        <span className={styles.key}>{t("sessions.detail.effort")}</span>
        <span>{s.effort ?? unknown}</span>
        <span className={styles.key}>{t("sessions.detail.permissions")}</span>
        <span>{s.permissionMode ?? unknown}</span>
        {!s.isOutsideSelo && (
          <>
            <span className={styles.key}>{t("sessions.detail.blueprint")}</span>
            <span className={styles.mono}>{s.blueprint ?? unknown}</span>
          </>
        )}
        <span className={styles.key}>{t("sessions.detail.folder")}</span>
        <span className={styles.mono}>{s.folder}</span>
        <span className={styles.key}>{t("sessions.detail.session")}</span>
        <span className={styles.mono}>{s.id}</span>
        <span className={styles.key}>{t("sessions.detail.writtenBy")}</span>
        <span className={styles.mono}>
          {writtenByText(s)}
          {isPluginOutdated && <PluginWarning session={s} />}
        </span>
      </div>
    </Section>
  );
  return (
    <>
      <div className={styles.head}>
        <div className={styles.row}>
          <span className={styles.state}>
            <StateLabel session={s} />
            {tag.isTag && <Tag>{tag.text}</Tag>}
          </span>
          <span className={styles.headButtons}>
            <span className={styles.fullscreen}>
              <IconButton label={isFullscreen ? t("sessions.detail.exitFullscreenHint") : t("sessions.detail.fullscreenHint")} aria-pressed={isFullscreen} onClick={onToggleFullscreen}>
                {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
              </IconButton>
            </span>
            <IconButton label={t("sessions.detail.closeHint")} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </span>
        </div>
        <h2 className={styles.title}>{requestText(s)}</h2>
        {s.note && <NoteText note={s.note} />}
        <div className={styles.meta}>
          <span>{projectName}</span>
          {s.branch && (
            <span className={styles.branch}>
              <BranchIcon />
              <span className={styles.mono}>{s.branch}</span>
            </span>
          )}
          <span className={styles.mono} style={{ color: laneColor(s) }}>{workLabel(s)}</span>
          {(s.model || s.effort) && <span className={styles.mono}>{[s.model, s.effort].filter(Boolean).join(" · ")}</span>}
          <span>{createdText(s.createdAt, now)}</span>
          <span>{t("sessions.detail.updated", { age: age(ageMs({ ...s, isArchived: false }, now)) })}</span>
        </div>
        <div className={styles.actions}>
          <Button variant="primary" size="sm" onClick={() => actions.onResume(s)}>
            <OpenIcon />
            {t("sessions.actions.open")}
          </Button>
          <Button size="sm" onClick={() => actions.onEditNote(s)}>
            <NoteIcon />
            {t("sessions.actions.note")}
          </Button>
          <FlagButton id={s.id} flags={actions.flags} />
          {(s.canArchive || s.isArchived) && (
            <span className={extras.archive}>
              {s.canArchive && (
                <Button size="sm" onClick={() => actions.onArchive(s)}>
                  <ArchiveIcon />
                  {t("sessions.actions.archive")}
                </Button>
              )}
              {s.isArchived && (
                <Button size="sm" onClick={() => actions.onUnarchive(s.id)}>
                  <UnarchiveIcon />
                  {t("sessions.actions.unarchive")}
                </Button>
              )}
            </span>
          )}
        </div>
        <NotifySwitch id={s.id} flags={actions.flags} />
      </div>

      {isFullscreen ? (
        // Full screen only: the sections become cards in two stacks, the narrow one with the state of the session
        // and its outcome (what is awaited, closing, recap and files), the wide one with the usage, the subagents and the settings.
        <div className={`${styles.body} ${styles.cards}`}>
          <div className={styles.stack}>
            {awaitedSection}
            {nextSection}
            {closeSection}
            {recapSection}
            {trailSection}
            {filesSection}
          </div>
          <div className={styles.stack}>
            {usageSection}
            {agentsSection}
            {settingsSection}
          </div>
        </div>
      ) : (
        <div className={styles.body}>
          {awaitedSection}
          {nextSection}
          {closeSection}
          {recapSection}
          {trailSection}
          {filesSection}
          {usageSection}
          {agentsSection}
          {settingsSection}
        </div>
      )}
    </>
  );
}

const HUES = {
  muted: styles.hueMuted,
  warn: styles.hueWarn,
  danger: styles.hueDanger,
  close: styles.hueClose,
  recap: styles.hueRecap,
  agents: styles.hueAgents,
  files: styles.hueFiles,
  usage: styles.hueUsage,
  trail: styles.hueTrail,
  next: extras.hueNext,
};

// A section: its heading (the icon in the section's own hue, the title and, for a list, how many it holds)
// folds and unfolds it (sessions-live FR-31).
function Section({
  icon,
  hue,
  title,
  count,
  summary,
  aside,
  isEmpty,
  isFolded,
  onToggle,
  children,
}: {
  icon: ReactNode;
  hue: keyof typeof HUES;
  title: string;
  count?: number;
  // What the heading keeps showing while the section is folded.
  summary?: ReactNode;
  // What the heading shows folded or not, after the summary.
  aside?: ReactNode;
  // Nothing more than the summary to show: the heading alone, with no chevron.
  isEmpty: boolean;
  isFolded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = useId();
  if (isEmpty) {
    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={`${styles.sectionToggle} ${styles.still}`}>
            <span className={`${styles.chip} ${HUES[hue]}`}>{icon}</span>
            {title}
            {summary ? <span className={styles.summary}>{summary}</span> : null}
          </span>
        </h3>
      </section>
    );
  }
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <button type="button" className={styles.sectionToggle} aria-expanded={!isFolded} aria-controls={bodyId} onClick={onToggle}>
          <span className={`${styles.chip} ${HUES[hue]}`}>{icon}</span>
          {title}
          {count ? <span className={styles.count}>{count}</span> : null}
          {isFolded && summary ? <span className={styles.summary}>{summary}</span> : null}
          {aside ? (
            <span className={styles.aside}>
              {isFolded && summary ? " · " : null}
              {aside}
            </span>
          ) : null}
          <span className={styles.fold}>{isFolded ? <ChevronRightIcon /> : <ChevronDownIcon />}</span>
        </button>
      </h3>
      <div id={bodyId} className={styles.sectionBody} hidden={isFolded}>
        {children}
      </div>
    </section>
  );
}
