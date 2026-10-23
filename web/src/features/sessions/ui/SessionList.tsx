import { t } from "../../../shared/lib/i18n/index.ts";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { NoteIcon, OpenIcon } from "../../../shared/ui/icons.tsx";
import { isOpen, isTodo, type Session } from "../data/sessionView.ts";
import { AgeLabel, AwaitedIcon, FilesCount, LaneLabel, NoteText, PluginWarning, StateLabel } from "./SessionBits.tsx";
import { awaitedOf, requestText } from "./sessionText.ts";
import { totalTokens } from "./usage.ts";
import { TokenCount } from "./UsageParts.tsx";
import styles from "./SessionList.module.css";

export interface SessionActions {
  onOpen: (id: string) => void;
  onResume: (session: Session) => void;
  onToggleNext: (id: string) => void;
  onCopyNext: (session: Session) => void;
  onArchive: (session: Session) => void;
  onUnarchive: (id: string) => void;
  onEditNote: (session: Session) => void;
}

interface Layout {
  showProject: boolean;
  // The detail is open: the fixed columns narrow (sessions-live FR-18).
  isNarrow: boolean;
}

const cols = ({ showProject, isNarrow }: Layout) => `${showProject ? styles.withProject : styles.noProject} ${isNarrow ? styles.narrow : ""}`;

export function ColumnHead(layout: Layout) {
  return (
    <div className={`${styles.head} ${cols(layout)}`} aria-hidden="true">
      <span>{t("sessions.columns.state")}</span>
      {layout.showProject && <span>{t("sessions.columns.project")}</span>}
      <span>{t("sessions.columns.type")}</span>
      <span>{t("sessions.columns.request")}</span>
      <span>{t("sessions.columns.awaited")}</span>
      <span />
      <span className={styles.end}>{t("sessions.columns.age")}</span>
      <span className={styles.end}>{t("sessions.columns.tokens")}</span>
    </div>
  );
}

// sessions-live FR-11: one dense row per session.
export function SessionList({
  sessions,
  projectName,
  now,
  selectedId,
  outdatedIds,
  actions,
  ...layout
}: Layout & {
  sessions: Session[];
  projectName: (projectId: string) => string;
  now: number;
  selectedId: string | null;
  outdatedIds: ReadonlySet<string>;
  actions: SessionActions;
}) {
  return (
    <ul className={`${styles.rows} ${cols(layout)}`}>
      {sessions.map((s) => {
        const awaited = isTodo(s) ? awaitedOf(s) : null;
        const tint = isTodo(s) ? (s.state === "stopped" ? styles.danger : styles.warn) : "";
        return (
          <li key={s.id} className={`${styles.row} ${tint} ${s.id === selectedId ? styles.selected : ""} ${isOpen(s) ? "" : styles.dim}`}>
            <button type="button" className={styles.main} onClick={() => actions.onOpen(s.id)} title={requestText(s)} aria-current={s.id === selectedId || undefined}>
              <span className={styles.state}>
                <StateLabel session={s} />
              </span>
              {layout.showProject && <span className={styles.muted}>{projectName(s.projectId)}</span>}
              <span className={styles.type}><LaneLabel session={s} /></span>
              <span className={styles.requestCell}>
                <span className={styles.request}>{requestText(s)}</span>
                {s.note && <NoteText note={s.note} isOneLine />}
              </span>
              <span className={styles.awaited}>
                {awaited && (
                  <>
                    <AwaitedIcon kind={awaited.kind} />
                    <span className={styles.key}>{awaited.key}</span>
                    <span className={styles.text}>{awaited.text}</span>
                  </>
                )}
              </span>
              <span className={styles.files}><FilesCount session={s} /></span>
              <span className={styles.age}>
                <AgeLabel session={s} now={now} />
                <span className={styles.warningSlot}>{outdatedIds.has(s.id) && <PluginWarning session={s} />}</span>
              </span>
              <span className={styles.tokens}>{s.usage && <TokenCount count={totalTokens(s.usage.tokens)} />}</span>
            </button>
            <IconButton label={t("sessions.actions.note")} onClick={() => actions.onEditNote(s)}>
              <NoteIcon />
            </IconButton>
            <IconButton label={t("sessions.actions.open")} tone="accent" onClick={() => actions.onResume(s)}>
              <OpenIcon />
            </IconButton>
          </li>
        );
      })}
    </ul>
  );
}
