import { ClockIcon, CommitIcon, QuestionIcon, WarningIcon } from "../../../shared/ui/icons.tsx";
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
      {stateLabel(session)}
    </span>
  );
}

// sessions-live FR-29: the type of work, coloured for libre, fastlane and autopilot.
export function LaneLabel({ session }: { session: Session }) {
  const tone = session.isOutsideSelo ? null : laneTone(session.lane);
  return <span className={tone ? styles[`lane-${tone}`] : undefined}>{sessionLaneLabel(session)}</span>;
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
      {kind === "question" ? <QuestionIcon /> : kind === "commit" ? <CommitIcon /> : <WarningIcon />}
    </span>
  );
}
