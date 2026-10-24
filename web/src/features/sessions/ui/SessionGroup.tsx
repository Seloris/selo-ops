import type { ReactNode } from "react";
import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { BranchIcon, ChevronRightIcon, PlusIcon } from "../../../shared/ui/icons.tsx";
import { StatusDot } from "../../../shared/ui/StatusDot.tsx";
import type { Bucket, Project } from "../data/sessionView.ts";
import { changedText } from "./sessionText.ts";
import styles from "./SessionGroup.module.css";

// A block of sessions on its glass surface; `isFlat` drops the surface (a folded section).
export function SessionGroup({ header, isFlat = false, children }: { header: ReactNode; isFlat?: boolean; children?: ReactNode }) {
  return (
    <section className={`${styles.group} ${isFlat ? styles.flat : ""}`}>
      {header}
      {children}
    </section>
  );
}

// sessions-live FR-12.
export function ProjectHeader({ project, count, todoCount, onNewSession }: { project: Project; count: number; todoCount: number; onNewSession?: () => void }) {
  const changed = changedText(project);
  return (
    <div className={styles.head}>
      <span className={styles.name}>{project.name}</span>
      <span className={styles.meta}>
        <BranchIcon />
        <span className={styles.mono}>{project.branch ?? t("sessions.group.noBranch")}</span>
      </span>
      {changed !== null && <span className={styles.meta}>· {changed}</span>}
      <span className={styles.count}>
        {todoCount > 0 && <b>{t("sessions.group.todo", { count: todoCount })}</b>}
        <span>{tn("sessions.group.sessions", count)}</span>
        {onNewSession && (
          <IconButton label={t("sessions.new.openIn", { project: project.name })} onClick={onNewSession}>
            <PlusIcon />
          </IconButton>
        )}
      </span>
    </div>
  );
}

const BUCKET_TONE = { todo: "warn", run: "pulse", rest: "turn", done: "done" } as const;

export function StatusHeader({ bucket, count }: { bucket: Bucket; count: number }) {
  return (
    <div className={styles.head}>
      <StatusDot tone={BUCKET_TONE[bucket]} />
      <span className={styles.name}>{t(`sessions.bucket.${bucket}`)}</span>
      <span className={styles.count}>{tn("sessions.group.sessions", count)}</span>
    </div>
  );
}

export function ClosedHeader({ count }: { count: number }) {
  return (
    <div className={styles.head}>
      <span className={styles.name}>{t("sessions.group.closed")}</span>
      <span className={styles.meta}>{t("sessions.group.closedHint")}</span>
      <span className={styles.count}>{tn("sessions.group.sessions", count)}</span>
    </div>
  );
}

// sessions-live FR-17: folded by default.
export function ArchivedToggle({ count, isOpen, onToggle }: { count: number; isOpen: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`${styles.toggle} ${isOpen ? styles.toggleOpen : ""}`} aria-expanded={isOpen} onClick={onToggle}>
      <span className={styles.chevron}>
        <ChevronRightIcon />
      </span>
      <span className={styles.name}>{t("sessions.group.archived")}</span>
      <span className={styles.meta}>{count}</span>
    </button>
  );
}
