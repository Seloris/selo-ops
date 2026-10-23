import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { ClockIcon, CommitIcon, FileIcon, NoteIcon, QuestionIcon, ShieldIcon, WarningIcon } from "../../../shared/ui/icons.tsx";
import { StatusDot } from "../../../shared/ui/StatusDot.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import { isTodo, type Session } from "../data/sessionView.ts";
import { ageDisplay, laneTone, sessionLaneLabel, stateLabel, toneOf, type AwaitedKind } from "./sessionText.ts";
import styles from "./SessionBits.module.css";

// The pieces a row, a card and the detail share.

export function StateLabel({ session }: { session: Session }) {
  return (
    <span className={`${styles.state} ${isTodo(session) ? "" : styles.calm}`}>
      <StatusDot tone={toneOf(session)} />
      <span className={styles.stateText}>{stateLabel(session)}</span>
    </span>
  );
}

// sessions-live FR-29: the type of work, coloured for libre, fastlane and autopilot.
export function LaneLabel({ session }: { session: Session }) {
  const tone = session.isOutsideSelo ? null : laneTone(session.lane);
  return <span className={tone ? styles[`lane-${tone}`] : undefined}>{sessionLaneLabel(session)}</span>;
}

// sessions-live FR-39: a small warning on a session written by another selo-ops version than the installed one.
export function PluginWarning({ session }: { session: Session }) {
  if (!session.writtenBy) return null;
  const text = t("sessions.pluginOutdated", { version: session.writtenBy });
  return (
    <span className={styles.versionWarning} title={text} role="img" aria-label={text}>
      <WarningIcon />
    </span>
  );
}

// sessions-live FR-11: the count of files the session modified; nothing at 0 or outside selo (FR-30).
export function FilesCount({ session }: { session: Session }) {
  const count = session.touchedFiles.length;
  if (session.isOutsideSelo || count === 0) return null;
  const text = tn("sessions.filesCount", count);
  return (
    <span className={styles.filesCount} title={text} role="img" aria-label={text}>
      <FileIcon />
      {count}
    </span>
  );
}

export function AgeLabel({ session, now }: { session: Session; now: number }) {
  const age = ageDisplay(session, now);
  if (!age.isTag) return <span className={styles.age}>{age.text}</span>;
  return <Tag icon={age.isStale ? <ClockIcon /> : undefined}>{age.text}</Tag>;
}

// `isMuted`: a closed or archived session waits on nobody, so no state colour (sessions-live FR-10).
export function AwaitedIcon({ kind, isMuted = false }: { kind: AwaitedKind; isMuted?: boolean }) {
  return (
    <span className={`${styles.icon} ${isMuted ? styles.muted : kind === "error" ? styles.danger : styles.warn}`}>
      {kind === "question" ? <QuestionIcon /> : kind === "permission" ? <ShieldIcon /> : kind === "commit" ? <CommitIcon /> : <WarningIcon />}
    </span>
  );
}

// sessions-live FR-40: the person's note, cut to one line with `isOneLine` (whole in its tooltip).
export function NoteText({ note, isOneLine = false }: { note: string; isOneLine?: boolean }) {
  return (
    <span className={`${styles.note} ${isOneLine ? styles.noteOneLine : ""}`} title={isOneLine ? note : undefined}>
      <NoteIcon />
      <span className={styles.noteText}>{note}</span>
    </span>
  );
}
