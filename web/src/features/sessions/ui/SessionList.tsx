import type { CSSProperties } from "react";
import { t } from "../../../shared/lib/i18n/index.ts";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { NoteIcon, OpenIcon, PromptIcon } from "../../../shared/ui/icons.tsx";
import { isOpen, isTodo, type Session } from "../data/sessionView.ts";
import { AgeLabel, AwaitedIcon, FilesCount, PluginWarning, StateLabel } from "./SessionBits.tsx";
import { laneColor, requestText, rowContext, workLabel } from "./sessionText.ts";
import { NextButton } from "./NextAction.tsx";
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

// sessions-live FR-11: two lines per session — state, request and age, then type and project, the context and the counts.
export function SessionList({
  sessions,
  projectName,
  now,
  selectedId,
  outdatedIds,
  actions,
  showProject,
  isNarrow,
  metaChars,
}: {
  sessions: Session[];
  projectName: (projectId: string) => string;
  now: number;
  selectedId: string | null;
  outdatedIds: ReadonlySet<string>;
  actions: SessionActions;
  showProject: boolean;
  // The detail is open: the badge column narrows (sessions-live FR-18).
  isNarrow: boolean;
  // The longest second line of every list on the page, so all their columns line up (FR-11).
  metaChars: number;
}) {
  return (
    <ul className={`${styles.rows} ${isNarrow ? styles.narrow : ""}`} style={{ "--meta-ch": metaChars } as CSSProperties}>
      {sessions.map((s) => {
        const tint = isTodo(s) ? (s.state === "stopped" ? styles.danger : styles.warn) : "";
        return (
          <li key={s.id} className={`${styles.row} ${tint} ${s.id === selectedId ? styles.selected : ""} ${isOpen(s) ? "" : styles.dim}`}>
            <button type="button" className={styles.main} onClick={() => actions.onOpen(s.id)} title={requestText(s)} aria-current={s.id === selectedId || undefined}>
              <span className={styles.badge}>
                <StateLabel session={s} />
              </span>
              <span className={styles.request}>{requestText(s)}</span>
              <span className={styles.age}>
                <AgeLabel session={s} now={now} />
                <span className={styles.warningSlot}>{outdatedIds.has(s.id) && <PluginWarning session={s} />}</span>
              </span>
              <span className={styles.meta}>
                <span style={{ color: laneColor(s) }}>{workLabel(s)}</span>
                {showProject && ` · ${projectName(s.projectId)}`}
              </span>
              <RowContext session={s} />
              <span className={styles.counts}>
                <FilesCount session={s} />
                {s.usage && <span className={styles.tokens}><TokenCount count={totalTokens(s.usage.tokens)} /></span>}
              </span>
            </button>
            <span className={styles.actions}>
              <NextButton session={s} onCopy={actions.onCopyNext} />
              <IconButton
                label={s.note ? t("sessions.actions.editNote") : t("sessions.actions.note")}
                tone={s.note ? "mark" : "muted"}
                tooltip={s.note ? <NoteTip note={s.note} /> : undefined}
                onClick={() => actions.onEditNote(s)}
              >
                <NoteIcon />
              </IconButton>
              <IconButton label={t("sessions.actions.open")} tone="accent" onClick={() => actions.onResume(s)}>
                <OpenIcon />
              </IconButton>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// sessions-live FR-11: what is awaited in its state's colour, else the step at work, else the next action in violet.
function RowContext({ session }: { session: Session }) {
  const context = rowContext(session);
  if (context.kind === "awaited") {
    const { kind, text } = context.awaited;
    return (
      <span className={`${styles.context} ${kind === "error" ? styles.dangerText : styles.warnText}`}>
        <AwaitedIcon kind={kind} />
        <span className={styles.text}>{text}</span>
      </span>
    );
  }
  if (context.kind === "next") {
    return (
      <span className={styles.context}>
        <span className={styles.chip}>
          <PromptIcon />
          <span className={styles.text}>{context.command}</span>
        </span>
      </span>
    );
  }
  return (
    <span className={`${styles.context} ${styles.calm}`}>
      <span className={styles.text}>{context.kind === "step" ? context.text : t("sessions.row.nothing")}</span>
    </span>
  );
}

// sessions-live FR-11: the note, whole, in the card the note button shows on hover.
function NoteTip({ note }: { note: string }) {
  return (
    <span className={styles.tip}>
      <span className={styles.tipTitle}>{t("sessions.note.label")}</span>
      <span>{note}</span>
    </span>
  );
}
