import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { copyText } from "../../../shared/lib/clipboard.ts";
import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { BackIcon, ChevronRightIcon, CloseIcon, CommitIcon, CopyIcon, WarningIcon } from "../../../shared/ui/icons.tsx";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import { Segmented } from "../../../shared/ui/Segmented.tsx";
import type { FileDiff } from "../data/useFileDiffQuery.ts";
import type { FileStat } from "../data/useFileSummaryQuery.ts";
import { diffRows, diffStats, isCode, sideBySide, type CodeRow, type DiffRow } from "./diffRows.ts";
import { FileKindIcon, LineCounts } from "./FileTree.tsx";
import styles from "./FileViewer.module.css";

export interface FileDiffState {
  file: string;
  diff: FileDiff | undefined;
  isLoading: boolean;
  error: string | null;
}

export type DiffMode = "unified" | "side";

interface Part {
  key: string;
  sha: string | null;
  subject: string | null;
  // Null for a commit git no longer has.
  text: string | null;
  isCut: boolean;
}

function partsOf(diff: FileDiff): Part[] {
  const commits = diff.commits.map((c): Part => ({ key: c.sha, sha: c.sha, subject: c.subject, text: c.diff, isCut: c.isCut }));
  return diff.uncommitted ? [...commits, { key: "uncommitted", sha: null, subject: null, text: diff.uncommitted.diff, isCut: diff.uncommitted.isCut }] : commits;
}

// sessions-live FR-56: the right of the window. The tabs of the files opened, then the one shown: its path, its lines,
// the mode, the previous and next file, its parts' bar and its parts (FR-51).
export function FileViewer({
  tabs,
  state,
  stats,
  position,
  mode,
  isNarrow,
  onShow,
  onCloseTab,
  onStep,
  onMode,
  onBack,
}: {
  tabs: string[];
  state: FileDiffState | null;
  stats: ReadonlyMap<string, FileStat>;
  // The shown file's place among the explorer's files, from 1.
  position: { index: number; count: number } | null;
  mode: DiffMode;
  // Below 640 px: « ‹ Fichiers » back to the explorer, and « Unifié » only (FR-57).
  isNarrow: boolean;
  onShow: (file: string) => void;
  onCloseTab: (file: string) => void;
  onStep: (delta: 1 | -1) => void;
  onMode: (mode: DiffMode) => void;
  onBack: () => void;
}) {
  const file = state?.file ?? null;
  const stat = file === null ? undefined : stats.get(file);
  return (
    <div className={styles.viewer}>
      <div className={styles.tabs} role="tablist" aria-label={t("sessions.files.tabs")}>
        {isNarrow && (
          <button type="button" className={styles.back} onClick={onBack}>
            <BackIcon />
            {t("sessions.files.back")}
          </button>
        )}
        {tabs.map((tab) => (
          <span key={tab} className={`${styles.tab} ${tab === file ? styles.on : ""}`}>
            <button type="button" role="tab" aria-selected={tab === file} className={styles.tabName} title={tab} onClick={() => onShow(tab)}>
              <FileKindIcon path={tab} />
              <span className={styles.name}>{tab.split("/").pop()}</span>
              {stats.get(tab)?.isUncommitted && (
                <span className={styles.dot} aria-hidden>
                  •
                </span>
              )}
            </button>
            <button type="button" className={styles.tabClose} aria-label={t("sessions.files.closeTab")} title={t("sessions.files.closeTab")} onClick={() => onCloseTab(tab)}>
              <CloseIcon />
            </button>
          </span>
        ))}
      </div>
      {state === null || file === null ? (
        <p className={styles.empty}>{t("sessions.files.noTab")}</p>
      ) : (
        <>
          <div className={styles.head}>
            <Crumbs path={file} />
            {stat && <LineCounts added={stat.added} removed={stat.removed} />}
            {!isNarrow && (
              <Segmented
                label={t("sessions.files.mode")}
                value={mode}
                onChange={onMode}
                options={[
                  { value: "unified", label: t("sessions.files.unified") },
                  { value: "side", label: t("sessions.files.side") },
                ]}
              />
            )}
            {position && (
              <span className={styles.nav}>
                <IconButton label={t("sessions.files.previous")} disabled={position.index <= 1} onClick={() => onStep(-1)}>
                  <BackIcon />
                </IconButton>
                {t("sessions.files.position", position)}
                <IconButton label={t("sessions.files.next")} disabled={position.index >= position.count} onClick={() => onStep(1)}>
                  <ChevronRightIcon />
                </IconButton>
              </span>
            )}
            <CopyPath path={file} />
          </div>
          <DiffBody key={file} state={state} mode={isNarrow ? "unified" : mode} />
        </>
      )}
    </div>
  );
}

function Crumbs({ path }: { path: string }) {
  const steps = path.split("/");
  return (
    <span className={styles.crumbs} title={path}>
      {steps.map((step, i) => (
        <Fragment key={i}>
          {i > 0 && <span className={styles.sep}>›</span>}
          <span className={i === steps.length - 1 ? styles.leaf : undefined}>{step}</span>
        </Fragment>
      ))}
    </span>
  );
}

function CopyPath({ path }: { path: string }) {
  const [isCopied, setCopied] = useState(false);
  useEffect(() => {
    if (!isCopied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [isCopied]);
  return (
    <IconButton label={isCopied ? t("sessions.files.pathCopied") : t("sessions.files.copyPath")} tone={isCopied ? "accent" : "muted"} onClick={() => void copyText(path).then(setCopied)}>
      <CopyIcon />
    </IconButton>
  );
}

function DiffBody({ state: { diff, isLoading, error }, mode }: { state: FileDiffState; mode: DiffMode }) {
  const parts = useMemo(() => (diff ? partsOf(diff) : []), [diff]);
  const codeRef = useRef<HTMLDivElement>(null);
  const partRefs = useRef(new Map<string, HTMLElement>());
  const [inView, setInView] = useState<string | null>(null);
  // The part whose title is at the top of the code, or the last one once scrolled to the end.
  const onScroll = () => {
    const code = codeRef.current;
    if (!code) return;
    const top = code.getBoundingClientRect().top + 8;
    let current = parts[0]?.key ?? null;
    for (const part of parts) {
      const el = partRefs.current.get(part.key);
      if (el && el.getBoundingClientRect().top <= top) current = part.key;
    }
    setInView(current);
  };
  if (!diff) {
    if (isLoading) return <LoadingState>{t("sessions.diff.loading")}</LoadingState>;
    if (error !== null) return <ErrorMessage>{error || t("sessions.diff.error")}</ErrorMessage>;
    return null;
  }
  if (!diff.isAvailable) return <p className={styles.note}>{t("sessions.diff.noFolder")}</p>;
  if (parts.length === 0) return <p className={styles.note}>{t("sessions.diff.empty")}</p>;
  const shown = inView ?? parts[0]?.key;
  return (
    <>
      <div className={styles.parts} role="group" aria-label={t("sessions.files.parts")}>
        {parts.map((part) => (
          <button
            key={part.key}
            type="button"
            className={`${styles.part} ${part.key === shown ? styles.on : ""}`}
            aria-current={part.key === shown}
            title={part.subject ?? t("sessions.diff.uncommitted")}
            onClick={() => partRefs.current.get(part.key)?.scrollIntoView({ block: "start", behavior: "smooth" })}
          >
            {part.sha === null ? (
              <>
                <span className={styles.dirty} aria-hidden />
                {t("sessions.diff.uncommitted")}
              </>
            ) : (
              <>
                <CommitIcon />
                <span className={styles.sha}>{part.sha}</span>
              </>
            )}
            <PartCounts text={part.text} />
          </button>
        ))}
      </div>
      <div ref={codeRef} className={styles.code} onScroll={onScroll}>
        {isLoading && <p className={styles.reading}>{t("sessions.diff.loading")}</p>}
        {error !== null && <ErrorMessage>{error || t("sessions.diff.error")}</ErrorMessage>}
        {parts.map((part) => (
          <section
            key={part.key}
            ref={(el) => {
              if (el) partRefs.current.set(part.key, el);
              else partRefs.current.delete(part.key);
            }}
            className={styles.section}
          >
            <h4 className={styles.partTitle}>
              {part.sha === null ? (
                <>
                  <span className={styles.dirty} aria-hidden />
                  {t("sessions.diff.uncommitted")}
                </>
              ) : (
                <>
                  <CommitIcon />
                  <span className={styles.sha}>{part.sha}</span>
                  <span className={styles.subject}>{part.subject}</span>
                </>
              )}
              <PartCounts text={part.text} />
            </h4>
            {part.sha === null && (
              <p className={styles.notice}>
                <WarningIcon />
                {t("sessions.diff.sharedNotice")}
              </p>
            )}
            {part.text === null ? <p className={styles.note}>{t("sessions.diff.commitGone")}</p> : <PartCode text={part.text} mode={mode} />}
            {part.isCut && <p className={styles.note}>{t("sessions.diff.cut")}</p>}
          </section>
        ))}
      </div>
    </>
  );
}

function PartCounts({ text }: { text: string | null }) {
  const counts = useMemo(() => (text === null ? null : diffStats(text)), [text]);
  if (counts === null) return <span className={styles.unknown}>{t("sessions.files.unknownCount")}</span>;
  return <LineCounts added={counts.added} removed={counts.removed} />;
}

const SIGN = { add: "+", remove: "−", context: " " } as const;

function PartCode({ text, mode }: { text: string; mode: DiffMode }) {
  const rows = useMemo(() => diffRows(text), [text]);
  const pairs = useMemo(() => (mode === "side" ? sideBySide(rows) : null), [rows, mode]);
  if (pairs) {
    return (
      <table className={`${styles.table} ${styles.side}`}>
        <tbody>
          {pairs.map((pair, i) =>
            pair.kind === "full" ? (
              <FullRow key={i} row={pair.row} span={6} />
            ) : (
              <tr key={i}>
                <SideCells row={pair.left} line={pair.left?.old ?? null} />
                <SideCells row={pair.right} line={pair.right?.new ?? null} />
              </tr>
            ),
          )}
        </tbody>
      </table>
    );
  }
  return (
    <table className={styles.table}>
      <tbody>
        {rows.map((row, i) =>
          isCode(row) ? (
            <tr key={i} className={styles[row.kind]}>
              <td className={styles.ln}>{row.old ?? ""}</td>
              <td className={styles.ln}>{row.new ?? ""}</td>
              <td className={styles.sign}>{SIGN[row.kind]}</td>
              <td className={styles.text}>{row.text || " "}</td>
            </tr>
          ) : (
            <FullRow key={i} row={row} span={4} />
          ),
        )}
      </tbody>
    </table>
  );
}

function SideCells({ row, line }: { row: CodeRow | null; line: number | null }) {
  const kind = row === null ? "blank" : row.kind;
  return (
    <>
      <td className={`${styles.ln} ${styles[kind]}`}>{line ?? ""}</td>
      <td className={`${styles.sign} ${styles[kind]}`}>{row ? SIGN[row.kind] : ""}</td>
      <td className={`${styles.text} ${styles[kind]}`}>{row ? row.text || " " : ""}</td>
    </>
  );
}

function FullRow({ row, span }: { row: Exclude<DiffRow, CodeRow>; span: number }) {
  if (row.kind === "gap") {
    return (
      <tr className={styles.gap}>
        <td className={styles.ln}>⋯</td>
        <td className={styles.ln}>{span === 4 ? "⋯" : ""}</td>
        <td colSpan={span - 2}>{tn("sessions.files.gap", row.count)}</td>
      </tr>
    );
  }
  return (
    <tr className={styles[row.kind]}>
      <td colSpan={span} className={styles.text}>
        {row.text}
      </td>
    </tr>
  );
}
