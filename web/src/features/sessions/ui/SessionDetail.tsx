import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { CommandBox } from "../../../shared/ui/CommandBox.tsx";
import { useId, type ReactNode } from "react";
import { ArchiveIcon, BranchIcon,ChevronDownIcon, ChevronRightIcon, CloseIcon, CollapseIcon, CommitIcon, DoorIcon, ExpandIcon, FolderIcon, GaugeIcon, HourglassIcon, NoteIcon, OpenIcon, PromptIcon, RobotIcon, SlidersIcon, UnarchiveIcon, WarningIcon } from "../../../shared/ui/icons.tsx";
import { StatusDot } from "../../../shared/ui/StatusDot.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import { ageMs, isTodo, type Session } from "../data/sessionView.ts";
import type { DetailSection } from "./detailSections.ts";
import { FileTree } from "./FileTree.tsx";
import { totalTokens, usageSummary } from "./usage.ts";
import { TokenCount, UsageDashboard } from "./UsageParts.tsx";
import { AwaitedIcon, LaneLabel, NoteText, PluginWarning, StateLabel } from "./SessionBits.tsx";
import type { SessionActions } from "./SessionList.tsx";
import { age, ageDisplay, awaitedOf, blockerHint, blockerLabel, blockerTone, calmText, closeText, createdText, requestText, shownBlockers, stateLabel, writtenByText } from "./sessionText.ts";
import styles from "./SessionDetail.module.css";

// sessions-live FR-19 to FR-23: everything the export knows of one session, and its actions. A session outside selo
// (sessions-live FR-30) shows no recap, commits, subagents, files modified nor blueprint: only the export gives them.
export function SessionDetail({
  session: s,
  projectName,
  now,
  isNextOpen,
  isPluginOutdated,
  foldedSections,
  actions,
  isFullscreen,
  onClose,
  onToggleFullscreen,
  onToggleSection,
}: {
  session: Session;
  projectName: string;
  now: number;
  isNextOpen: boolean;
  isPluginOutdated: boolean;
  foldedSections: readonly DetailSection[];
  actions: SessionActions;
  isFullscreen: boolean;
  onClose: () => void;
  onToggleFullscreen: () => void;
  onToggleSection: (section: DetailSection) => void;
}) {
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
  const filesSection = !s.isOutsideSelo && (
    <Section icon={<FolderIcon />} hue="files" count={s.touchedFiles.length} title={t("sessions.detail.files")} summary={s.touchedFiles.length ? s.touchedFiles.map((f) => f.split("/").pop()).join(" · ") : t("sessions.detail.none")} {...fold("files", s.touchedFiles.length === 0)}>
      <FileTree paths={s.touchedFiles} />
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
              <Button size="sm" aria-pressed={isFullscreen} title={isFullscreen ? t("sessions.detail.exitFullscreenHint") : t("sessions.detail.fullscreenHint")} onClick={onToggleFullscreen}>
                {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
                {isFullscreen ? t("sessions.detail.exitFullscreen") : t("sessions.detail.fullscreen")}
              </Button>
            </span>
            <Button size="sm" title={t("sessions.detail.closeHint")} onClick={onClose}>
              <CloseIcon />
              {t("sessions.detail.close")}
            </Button>
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
          <span className={styles.mono}><LaneLabel session={s} /></span>
          <span>{createdText(s.createdAt, now)}</span>
          <span>{t("sessions.detail.updated", { age: age(ageMs({ ...s, isArchived: false }, now)) })}</span>
        </div>
        <div className={styles.actions}>
          <Button variant="primary" size="sm" onClick={() => actions.onResume(s)}>
            <OpenIcon />
            {t("sessions.actions.open")}
          </Button>
          {s.nextAction && !s.isArchived && (
            <Button size="sm" aria-expanded={isNextOpen} onClick={() => actions.onToggleNext(s.id)}>
              <PromptIcon />
              {t("sessions.actions.next")}
            </Button>
          )}
          <Button size="sm" onClick={() => actions.onEditNote(s)}>
            <NoteIcon />
            {t("sessions.actions.note")}
          </Button>
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
        </div>
        {isNextOpen && s.nextAction && !s.isArchived && <CommandBox command={s.nextAction} copyLabel={t("sessions.actions.copy")} onCopy={() => actions.onCopyNext(s)} />}
      </div>

      {isFullscreen ? (
        // Full screen only: the sections become cards in two stacks, the narrow one with the state of the session
        // and its outcome (what is awaited, closing, recap and files), the wide one with the usage, the subagents and the settings.
        <div className={`${styles.body} ${styles.cards}`}>
          <div className={styles.stack}>
            {awaitedSection}
            {closeSection}
            {recapSection}
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
          {closeSection}
          {recapSection}
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
};

// A section: its heading (the icon in the section's own hue, the title and, for a list, how many it holds)
// folds and unfolds it (sessions-live FR-31).
function Section({
  icon,
  hue,
  title,
  count,
  summary,
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
  summary?: string | null;
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
          <span className={styles.fold}>{isFolded ? <ChevronRightIcon /> : <ChevronDownIcon />}</span>
        </button>
      </h3>
      <div id={bodyId} className={styles.sectionBody} hidden={isFolded}>
        {children}
      </div>
    </section>
  );
}
