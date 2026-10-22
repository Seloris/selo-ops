import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { CommandBox } from "../../../shared/ui/CommandBox.tsx";
import { useId, type ReactNode } from "react";
import { ArchiveIcon, BranchIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CloseIcon, CommitIcon, DoorIcon, FolderIcon, HourglassIcon, OpenIcon, PromptIcon, RobotIcon, SlidersIcon, UnarchiveIcon, WarningIcon } from "../../../shared/ui/icons.tsx";
import { StatusDot } from "../../../shared/ui/StatusDot.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import { ageMs, isTodo, type Session } from "../data/sessionView.ts";
import type { DetailSection } from "./detailSections.ts";
import { FileTree } from "./FileTree.tsx";
import { AwaitedIcon, LaneLabel, StateLabel } from "./SessionBits.tsx";
import type { SessionActions } from "./SessionList.tsx";
import { age, ageDisplay, awaitedOf, blockerHint, blockerLabel, blockerTone, calmText, closeText, requestText, shownBlockers, stateLabel } from "./sessionText.ts";
import styles from "./SessionDetail.module.css";

// sessions-live FR-19 to FR-23: everything the export knows of one session, and its actions. A session outside selo
// (sessions-live FR-30) shows no recap, commits, subagents, files touched nor blueprint: only the export gives them.
export function SessionDetail({
  session: s,
  projectName,
  now,
  isNextOpen,
  foldedSections,
  actions,
  onClose,
  onToggleSection,
}: {
  session: Session;
  projectName: string;
  now: number;
  isNextOpen: boolean;
  foldedSections: readonly DetailSection[];
  actions: SessionActions;
  onClose: () => void;
  onToggleSection: (section: DetailSection) => void;
}) {
  const awaited = awaitedOf(s);
  const blockers = shownBlockers(s);
  const tag = ageDisplay(s, now);
  const unknown = t("sessions.facts.unknown");
  const fold = (section: DetailSection) => ({ isFolded: foldedSections.includes(section), onToggle: () => onToggleSection(section) });
  return (
    <>
      <div className={styles.head}>
        <div className={styles.row}>
          <span className={styles.state}>
            <StateLabel session={s} />
            {tag.isTag && <Tag>{tag.text}</Tag>}
          </span>
          <Button size="sm" title={t("sessions.detail.closeHint")} onClick={onClose}>
            <CloseIcon />
            {t("sessions.detail.close")}
          </Button>
        </div>
        <h2 className={styles.title}>{requestText(s)}</h2>
        <div className={styles.meta}>
          <span>{projectName}</span>
          {s.branch && (
            <span className={styles.branch}>
              <BranchIcon />
              <span className={styles.mono}>{s.branch}</span>
            </span>
          )}
          <span className={styles.mono}><LaneLabel session={s} /></span>
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

      <div className={styles.body}>
        <Section icon={<HourglassIcon />} hue={!awaited || !isTodo(s) ? "muted" : awaited.kind === "error" ? "danger" : "warn"} title={t("sessions.detail.awaited")} {...fold("awaited")}>
          {awaited ? (
            <div className={`${styles.ask} ${!isTodo(s) ? styles.neutral : awaited.kind === "error" ? styles.danger : styles.warn}`}>
              <AwaitedIcon kind={awaited.kind} isMuted={!isTodo(s)} />
              <div>
                <b>{awaited.label}</b>
                <p className={`${styles.pre} ${awaited.isCode ? styles.mono : ""}`}>{awaited.full}</p>
              </div>
            </div>
          ) : (
            <p className={styles.muted}>{calmText(s)}</p>
          )}
        </Section>

        <Section icon={<DoorIcon />} hue="close" title={t("sessions.detail.canClose")} {...fold("close")}>
          {s.isOutsideSelo ? (
            <div className={`${styles.verdict} ${styles.neutral}`}>
              <WarningIcon />
              <b>{closeText(s)}</b>
            </div>
          ) : s.blockers.length === 0 ? (
            <div className={`${styles.verdict} ${styles.neutral}`}>
              <CheckIcon />
              <b>{t("sessions.close.yes")}</b>
            </div>
          ) : (
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

        {!s.isOutsideSelo && (s.recap || s.commits.length > 0) && (
          <Section icon={<CommitIcon />} hue="recap" title={t("sessions.detail.recap")} {...fold("recap")}>
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
        )}

        {!s.isOutsideSelo && (
          <Section icon={<RobotIcon />} hue="agents" count={s.subagents.length} title={t("sessions.detail.subagents")} {...fold("agents")}>
            {s.subagents.length ? (
              <ul className={styles.lines}>
                {s.subagents.map((a, i) => (
                  <li key={i}>
                    <span className={styles.hash}>{a.type}</span>
                    <span className={styles.line}>{a.task ?? ""}</span>
                    <span className={styles.status}>{stateLabel({ ...s, state: a.state })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>{t("sessions.detail.none")}</p>
            )}
          </Section>
        )}

        {!s.isOutsideSelo && (
          <Section icon={<FolderIcon />} hue="files" count={s.touchedFiles.length} title={t("sessions.detail.files")} {...fold("files")}>
            {s.touchedFiles.length ? (
              <FileTree paths={s.touchedFiles} />
            ) : (
              <p className={styles.muted}>{t("sessions.detail.none")}</p>
            )}
          </Section>
        )}

        <Section icon={<SlidersIcon />} hue="muted" title={t("sessions.detail.settings")} {...fold("settings")}>
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
          </div>
        </Section>
      </div>
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
};

// A section: its heading (the icon in the section's own hue, the title and, for a list, how many it holds)
// folds and unfolds it (sessions-live FR-31).
function Section({
  icon,
  hue,
  title,
  count,
  isFolded,
  onToggle,
  children,
}: {
  icon: ReactNode;
  hue: keyof typeof HUES;
  title: string;
  count?: number;
  isFolded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = useId();
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <button type="button" className={styles.sectionToggle} aria-expanded={!isFolded} aria-controls={bodyId} onClick={onToggle}>
          <span className={`${styles.chip} ${HUES[hue]}`}>{icon}</span>
          {title}
          {count ? <span className={styles.count}>{count}</span> : null}
          <span className={styles.fold}>{isFolded ? <ChevronRightIcon /> : <ChevronDownIcon />}</span>
        </button>
      </h3>
      <div id={bodyId} className={styles.sectionBody} hidden={isFolded}>
        {children}
      </div>
    </section>
  );
}
