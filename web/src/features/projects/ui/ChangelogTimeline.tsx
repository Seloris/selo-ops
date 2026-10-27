import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { EmptyState } from "../../../shared/ui/EmptyState.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { BlueprintIcon, CheckIcon, NoteIcon, PlusIcon, RefreshIcon } from "../../../shared/ui/icons.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import { frenchDate, kindCounts, parseChangelog, relativeDay, type ChangeEntry, type ChangeKind } from "./changelog.ts";
import { InlineMarkdown } from "./Markdown.tsx";
import styles from "./ChangelogTimeline.module.css";

// The days shown before « Voir tout l'historique ».
const RECENT_DAYS = 5;

const KINDS: { kind: ChangeKind; color: string; icon: ReactNode }[] = [
  { kind: "added", color: "var(--log-added)", icon: <PlusIcon /> },
  { kind: "changed", color: "var(--log-changed)", icon: <RefreshIcon /> },
  { kind: "fixed", color: "var(--log-fixed)", icon: <CheckIcon /> },
  { kind: "other", color: "var(--log-other)", icon: <NoteIcon /> },
];
const KIND_OF = new Map(KINDS.map((k) => [k.kind, k]));

export interface ChangelogState {
  isPending: boolean;
  error: string | null;
  // The file's text; null when the project has none.
  text: string | null;
}

// projects FR-18: the project's changelog as a vertical timeline, one node per day, its entries tagged by kind.
export function ChangelogTimeline({
  changelog,
  today,
  blueprintFiles,
  openPath,
  onOpenFile,
}: {
  changelog: ChangelogState;
  // The local day, `YYYY-MM-DD`, for « aujourd'hui » and « hier ».
  today: string;
  // The blueprints the project lists: a link to another one shows, but does not open.
  blueprintFiles: Set<string>;
  openPath: string | null;
  onOpenFile: (path: string) => void;
}) {
  const [isAll, setAll] = useState(false);
  const days = useMemo(() => (changelog.text === null ? [] : parseChangelog(changelog.text)), [changelog.text]);

  if (changelog.isPending) return <LoadingState>{t("projects.changelog.loading")}</LoadingState>;
  if (changelog.error !== null) return <ErrorMessage>{t("projects.changelog.error", { message: changelog.error || t("projects.page.errorUnknown") })}</ErrorMessage>;
  if (changelog.text === null) return <EmptyState>{t("projects.changelog.none")}</EmptyState>;
  if (days.length === 0) return <EmptyState>{t("projects.changelog.noEntry")}</EmptyState>;

  const counts = kindCounts(days);
  const shown = isAll ? days : days.slice(0, RECENT_DAYS);
  const hidden = days.length - RECENT_DAYS;

  const entry = (e: ChangeEntry, i: number) => {
    const kind = KIND_OF.get(e.kind) ?? KINDS[3];
    // An unknown kind keeps its word in front of its text: the tag stays « Note ».
    const text = e.label ? `${e.label} — ${e.text}` : e.text;
    return (
      <li key={i} className={styles.entry} style={{ "--kind": kind?.color } as CSSProperties}>
        <span className={styles.entryDot} aria-hidden="true" />
        <div className={styles.card}>
          <span className={styles.kindCell}>
            <Tag color={kind?.color} icon={kind?.icon}>
              {t(`projects.changelog.kind.${e.kind}`)}
            </Tag>
          </span>
          <p className={styles.text}>
            <InlineMarkdown text={text} />
          </p>
          {e.blueprint !== null &&
            (blueprintFiles.has(e.blueprint) ? (
              <button type="button" className={styles.bpLink} onClick={() => onOpenFile(e.blueprint ?? "")} aria-current={openPath === e.blueprint || undefined} title={e.blueprint}>
                <BlueprintIcon />
                {t("projects.changelog.blueprint")}
              </button>
            ) : (
              <span className={styles.bpGone} title={t("projects.changelog.blueprintGone")}>
                <BlueprintIcon />
                {t("projects.changelog.blueprint")}
              </span>
            ))}
        </div>
      </li>
    );
  };

  return (
    <div className={styles.changelog}>
      <ul className={styles.legend}>
        {KINDS.filter((k) => counts[k.kind] > 0).map((k) => (
          <li key={k.kind} style={{ "--kind": k.color } as CSSProperties}>
            <span className={styles.swatch} aria-hidden="true" />
            {tn(`projects.changelog.count.${k.kind}`, counts[k.kind])}
          </li>
        ))}
      </ul>
      <ol className={styles.timeline} aria-label={t("projects.changelog.label")}>
        {shown.map((day, i) => {
          const relative = day.date === null ? null : relativeDay(day.date, today);
          return (
            <li key={`${day.heading}-${i}`} className={`${styles.day} ${i === 0 ? styles.latest : ""}`}>
              <span className={styles.node} aria-hidden="true" />
              <h4 className={styles.dayHead}>
                <time className={styles.date} dateTime={day.date ?? undefined}>
                  {day.date === null ? day.heading : frenchDate(day.date)}
                </time>
                {relative && <span className={styles.relative}>{t(`projects.changelog.${relative}`)}</span>}
                <span className={styles.dayCount}>{tn("projects.changelog.entries", day.entries.length)}</span>
              </h4>
              <ul className={styles.entries}>{day.entries.map(entry)}</ul>
            </li>
          );
        })}
      </ol>
      {hidden > 0 && (
        <div className={styles.more}>
          <Button size="sm" variant="ghost" onClick={() => setAll(!isAll)} aria-expanded={isAll}>
            {isAll ? t("projects.changelog.showLess") : tn("projects.changelog.showAll", hidden)}
          </Button>
        </div>
      )}
    </div>
  );
}
