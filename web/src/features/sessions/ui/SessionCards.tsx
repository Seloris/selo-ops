import { t } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { CommandBox } from "../../../shared/ui/CommandBox.tsx";
import { ArchiveIcon, OpenIcon, PromptIcon } from "../../../shared/ui/icons.tsx";
import { isOpen, isTodo, type Session } from "../data/sessionView.ts";
import { AgeLabel, AwaitedIcon, LaneLabel, StateLabel } from "./SessionBits.tsx";
import type { SessionActions } from "./SessionList.tsx";
import { awaitedOf, calmText, closeText, modelText, requestText } from "./sessionText.ts";
import styles from "./SessionCards.module.css";

// sessions-live FR-13: a grid of cards with every detail.
export function SessionCards({
  sessions,
  showProject,
  projectName,
  now,
  selectedId,
  nextShown,
  actions,
}: {
  sessions: Session[];
  showProject: boolean;
  projectName: (projectId: string) => string;
  now: number;
  selectedId: string | null;
  nextShown: Set<string>;
  actions: SessionActions;
}) {
  return (
    <ul className={styles.grid}>
      {sessions.map((s) => {
        const awaited = awaitedOf(s);
        const tint = isTodo(s) ? (s.state === "stopped" ? styles.danger : styles.warn) : "";
        const hasNext = s.nextAction !== null && !s.isArchived;
        const isNextOpen = hasNext && nextShown.has(s.id);
        return (
          <li key={s.id} className={`${styles.card} ${tint} ${s.id === selectedId ? styles.selected : ""} ${isOpen(s) ? "" : styles.dim}`}>
            <button type="button" className={styles.main} onClick={() => actions.onOpen(s.id)} aria-current={s.id === selectedId || undefined}>
              <span className={styles.head}>
                <StateLabel session={s} />
                {showProject && <span className={styles.meta}>· {projectName(s.projectId)}</span>}
                <span className={`${styles.meta} ${styles.mono}`}>· <LaneLabel session={s} /></span>
                <span className={styles.end}>
                  <AgeLabel session={s} now={now} />
                </span>
              </span>
              <span className={styles.request}>{requestText(s)}</span>
              {awaited ? (
                <span className={styles.awaited}>
                  <AwaitedIcon kind={awaited.kind} isMuted={!isTodo(s)} />
                  <span>
                    <b>{awaited.label}</b> <span className={awaited.isCode ? styles.mono : ""}>{awaited.text}</span>
                  </span>
                </span>
              ) : (
                <span className={styles.calm}>{calmText(s)}</span>
              )}
              <span className={styles.facts}>
                <span>{t("sessions.facts.model")}</span>
                <span className={styles.value}>{modelText(s)}</span>
                <span>{t("sessions.facts.permissions")}</span>
                <span className={styles.value}>{s.permissionMode ?? t("sessions.facts.unknown")}</span>
                <span>{t("sessions.facts.close")}</span>
                <span className={styles.value}>{closeText(s)}</span>
              </span>
            </button>
            {isNextOpen && s.nextAction && (
              <div className={styles.command}>
                <CommandBox command={s.nextAction} copyLabel={t("sessions.actions.copy")} onCopy={() => actions.onCopyNext(s)} />
              </div>
            )}
            <div className={styles.foot}>
              <Button variant="primary" size="sm" title={t("sessions.actions.open")} onClick={() => actions.onResume(s)}>
                <OpenIcon />
                {t("sessions.actions.openShort")}
              </Button>
              {hasNext && (
                <Button size="sm" aria-expanded={isNextOpen} onClick={() => actions.onToggleNext(s.id)}>
                  <PromptIcon />
                  {t("sessions.actions.next")}
                </Button>
              )}
              {s.canArchive && (
                <span className={styles.push}>
                  <Button size="sm" onClick={() => actions.onArchive(s.id)}>
                    <ArchiveIcon />
                    {t("sessions.actions.archive")}
                  </Button>
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
