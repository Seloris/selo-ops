import { useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { readStored, writeStored } from "../../../shared/lib/storage.ts";
import { BranchIcon, FoldAllIcon, ListIcon, SearchIcon } from "../../../shared/ui/icons.tsx";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { Modal } from "../../../shared/ui/Modal.tsx";
import type { FileStat, FileSummary } from "../data/useFileSummaryQuery.ts";
import { fileTotals } from "./fileTotals.ts";
import { buildFileTree, filterPaths, folderPaths, orderedFiles } from "./fileTree.ts";
import { FileTree, LineCounts } from "./FileTree.tsx";
import { FileViewer, type DiffMode, type FileDiffState } from "./FileViewer.tsx";
import styles from "./FilesWindow.module.css";

const MODE_KEY = "selo-ops/sessions-live/diff-mode";
const EXPLORER_WIDTH = 300;
const MIN_EXPLORER = 200;
const MIN_VIEWER = 320;
const NARROW = "(max-width: 640px)";

const subscribeNarrow = (onChange: () => void) => {
  const media = window.matchMedia(NARROW);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const isNarrowNow = () => window.matchMedia(NARROW).matches;

// The counts of the window's head and of the explorer's foot (sessions-live FR-55).
function Totals({ count, stats }: { count: number; stats: FileStat[] | null }) {
  const totals = stats ? fileTotals(stats) : null;
  return (
    <span className={styles.totals}>
      <span>{tn("sessions.files.count", count)}</span>
      {totals && <LineCounts added={totals.added} removed={totals.removed} />}
      {totals && totals.uncommitted > 0 && <span className={styles.dirty}>{tn("sessions.files.uncommitted", totals.uncommitted)}</span>}
    </span>
  );
}

// sessions-live FR-55 to FR-57: the files a session modified in a window of their own, the explorer on the left and
// the viewer on the right; below 640 px, one of them at a time.
export function FilesWindow({
  request,
  branch,
  projectName,
  paths,
  summary,
  isSummaryFailed,
  shown,
  isFromExplorer,
  diff,
  onShow,
  onClose,
}: {
  request: string;
  branch: string | null;
  projectName: string;
  paths: string[];
  summary: FileSummary | undefined;
  isSummaryFailed: boolean;
  shown: string | null;
  // Opened by « Explorer » rather than by a file: below 640 px it starts on the explorer (FR-57).
  isFromExplorer: boolean;
  diff: FileDiffState | null;
  onShow: (file: string | null) => void;
  onClose: () => void;
}) {
  const isNarrow = useSyncExternalStore(subscribeNarrow, isNarrowNow);
  const [openedTabs, setTabs] = useState<string[]>(() => (shown === null ? [] : [shown]));
  // The file shown always has its tab, whoever showed it.
  const tabs = shown !== null && !openedTabs.includes(shown) ? [...openedTabs, shown] : openedTabs;
  const [filter, setFilter] = useState("");
  const [isFlat, setFlat] = useState(false);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [mode, setMode] = useState<DiffMode>(() => (readStored(MODE_KEY) === "side" ? "side" : "unified"));
  const [width, setWidth] = useState(EXPLORER_WIDTH);
  const [pane, setPane] = useState<"explorer" | "viewer">(shown === null || isFromExplorer ? "explorer" : "viewer");
  const ideRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => new Map((summary?.files ?? []).map((s) => [s.file, s])), [summary]);
  const statList = summary?.isAvailable ? summary.files : null;
  const order = useMemo(() => orderedFiles(buildFileTree(paths)), [paths]);
  const visible = useMemo(() => filterPaths(order, filter), [order, filter]);
  const index = shown === null ? -1 : order.indexOf(shown);

  const show = (file: string) => {
    if (!tabs.includes(file)) setTabs([...tabs, file]);
    onShow(file);
    setPane("viewer");
  };
  const closeTab = (file: string) => {
    const at = tabs.indexOf(file);
    const rest = tabs.filter((tab) => tab !== file);
    setTabs(rest);
    if (file === shown) onShow(rest[Math.min(at, rest.length - 1)] ?? null);
  };
  const toggleFolder = (path: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  const clampWidth = (value: number) => {
    const total = ideRef.current?.clientWidth ?? 0;
    return Math.round(Math.max(MIN_EXPLORER, Math.min(value, Math.max(MIN_EXPLORER, total - MIN_VIEWER))));
  };
  const onGripDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onGripMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const left = ideRef.current?.getBoundingClientRect().left ?? 0;
    setWidth(clampWidth(event.clientX - left));
  };
  const onGripKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setWidth((w) => clampWidth(w + (event.key === "ArrowRight" ? 16 : -16)));
  };

  return (
    <Modal
      title={t("sessions.detail.files")}
      size="wide"
      closeLabel={t("sessions.files.close")}
      subtitle={
        <span className={styles.sub}>
          <span className={styles.request} title={request}>
            {request}
          </span>
          {branch && (
            <span className={styles.branch}>
              <BranchIcon />
              {branch}
            </span>
          )}
          <span>{projectName}</span>
        </span>
      }
      aside={
        <span className={styles.headTotals}>
          <Totals count={paths.length} stats={statList} />
        </span>
      }
      onClose={onClose}
    >
      <div ref={ideRef} className={`${styles.ide} ${pane === "viewer" ? styles.onViewer : styles.onExplorer}`} style={{ "--explorer-w": `${width}px` } as CSSProperties}>
        <aside className={styles.explorer}>
          <div className={styles.xhead}>
            {t("sessions.files.explorer")}
            <span className={styles.count}>{paths.length}</span>
            <span className={styles.tools}>
              <IconButton label={t("sessions.files.collapseAll")} disabled={isFlat} onClick={() => setClosed(new Set(folderPaths(buildFileTree(visible))))}>
                <FoldAllIcon />
              </IconButton>
              <IconButton label={t("sessions.files.flat")} tone={isFlat ? "accent" : "muted"} aria-pressed={isFlat} onClick={() => setFlat((f) => !f)}>
                <ListIcon />
              </IconButton>
            </span>
          </div>
          <div className={styles.xbody}>
            <label className={styles.filter}>
              <SearchIcon />
              <input type="search" value={filter} placeholder={t("sessions.files.filter")} aria-label={t("sessions.files.filter")} onChange={(e) => setFilter(e.target.value)} />
            </label>
            {visible.length === 0 ? (
              <p className={styles.none}>{t("sessions.files.noMatch")}</p>
            ) : (
              <FileTree paths={visible} selected={shown} onSelect={show} stats={stats} openFiles={new Set(tabs)} isFlat={isFlat} closed={closed} onToggleFolder={toggleFolder} />
            )}
          </div>
          <div className={styles.xfoot}>{isSummaryFailed ? <span>{t("sessions.files.statsError")}</span> : <Totals count={paths.length} stats={statList} />}</div>
        </aside>
        <div
          className={styles.grip}
          role="separator"
          aria-orientation="vertical"
          aria-label={t("sessions.files.resize")}
          aria-valuenow={width}
          aria-valuemin={MIN_EXPLORER}
          tabIndex={0}
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onKeyDown={onGripKey}
          onDoubleClick={() => setWidth(EXPLORER_WIDTH)}
        />
        <FileViewer
          tabs={tabs}
          state={diff}
          stats={stats}
          position={index < 0 ? null : { index: index + 1, count: order.length }}
          mode={mode}
          isNarrow={isNarrow}
          onShow={show}
          onCloseTab={closeTab}
          onStep={(delta) => {
            const next = order[index + delta];
            if (next !== undefined) show(next);
          }}
          onMode={(next) => {
            setMode(next);
            writeStored(MODE_KEY, next);
          }}
          onBack={() => setPane("explorer")}
        />
      </div>
    </Modal>
  );
}
