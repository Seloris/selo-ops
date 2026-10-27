import { useMemo, useState, type ComponentType, type KeyboardEvent } from "react";
import { t } from "../../../shared/lib/i18n/index.ts";
import {
  BracesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeIcon,
  FileIcon,
  FolderIcon,
  HashIcon,
  ImageIcon,
  IndentIcon,
  JavaScriptIcon,
  MarkdownIcon,
  ReactIcon,
  TerminalIcon,
  TextFileIcon,
  TypeScriptIcon,
} from "../../../shared/ui/icons.tsx";
import type { FileStat } from "../data/useFileSummaryQuery.ts";
import { fileKind, type FileKind } from "./fileKind.ts";
import { buildFileTree, type FileNode } from "./fileTree.ts";
import styles from "./FileTree.module.css";

const iconByKind: Record<FileKind, ComponentType> = {
  markdown: MarkdownIcon,
  typescript: TypeScriptIcon,
  react: ReactIcon,
  javascript: JavaScriptIcon,
  json: BracesIcon,
  style: HashIcon,
  html: CodeIcon,
  yaml: IndentIcon,
  image: ImageIcon,
  shell: TerminalIcon,
  text: TextFileIcon,
  file: FileIcon,
};

export function FileKindIcon({ path }: { path: string }) {
  const Icon = iconByKind[fileKind(path)];
  return <Icon />;
}

// A file's lines added and removed (« +27 −7 »); nothing when they are unknown (a binary file, git not read yet).
export function LineCounts({ added, removed }: { added: number | null; removed: number | null }) {
  if (added === null || removed === null) return null;
  return (
    <span className={styles.counts}>
      <span className={styles.plus}>+{added}</span>
      <span className={styles.minus}>−{removed}</span>
    </span>
  );
}

function StatusLetter({ status }: { status: NonNullable<FileStat["status"]> }) {
  return (
    <span className={`${styles.status} ${styles[status]}`} title={t(`sessions.files.status.${status}`)}>
      {t(`sessions.files.letter.${status}`)}
    </span>
  );
}

export interface FileTreeProps {
  paths: string[];
  selected: string | null;
  onSelect: (path: string) => void;
  // Each file's status and lines, once git is read (sessions-live FR-54).
  stats?: ReadonlyMap<string, FileStat>;
  // The files open in a tab of the window, in bold (sessions-live FR-55).
  openFiles?: ReadonlySet<string>;
  // « Vue à plat »: every file by its whole path.
  isFlat?: boolean;
  // The folders folded, when the caller keeps them (« Tout replier »); else the tree keeps its own.
  closed?: ReadonlySet<string>;
  onToggleFolder?: (path: string) => void;
}

// The files a session modified, browsed folder by folder (sessions-live FR-54): every folder starts open, each file
// with the icon of its type, its lines and its status; ↑ and ↓ move between files.
export function FileTree({ paths, selected, onSelect, stats, openFiles, isFlat = false, closed: shownClosed, onToggleFolder }: FileTreeProps) {
  const tree = useMemo(() => buildFileTree(paths), [paths]);
  const [ownClosed, setOwnClosed] = useState<ReadonlySet<string>>(new Set());
  const closed = shownClosed ?? ownClosed;
  const toggle =
    onToggleFolder ??
    ((path: string) =>
      setOwnClosed((prev) => {
        const next = new Set(prev);
        if (!next.delete(path)) next.add(path);
        return next;
      }));
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-file]")];
    const at = buttons.findIndex((b) => b === document.activeElement);
    const next = buttons[at < 0 ? 0 : Math.min(buttons.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)))];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };
  const file = { selected, onSelect, stats, openFiles };
  if (isFlat) {
    return (
      <ul className={styles.tree} onKeyDown={onKeyDown}>
        {paths.map((path) => (
          <li key={path}>
            <FileButton path={path} name={path} isFlat {...file} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className={styles.tree} onKeyDown={onKeyDown}>
      <Nodes nodes={tree} closed={closed} onToggle={toggle} {...file} />
    </ul>
  );
}

type FileProps = Pick<FileTreeProps, "selected" | "onSelect" | "stats" | "openFiles">;

function FileButton({ path, name, isFlat = false, selected, onSelect, stats, openFiles }: FileProps & { path: string; name: string; isFlat?: boolean }) {
  const stat = stats?.get(path);
  const classes = [styles.file, isFlat ? styles.flat : "", path === selected ? styles.selected : "", openFiles?.has(path) ? styles.open : ""];
  return (
    <button type="button" data-file={path} className={classes.filter(Boolean).join(" ")} aria-pressed={path === selected} title={path} onClick={() => onSelect(path)}>
      <FileKindIcon path={path} />
      <span className={styles.name}>{name}</span>
      {stat && (
        <span className={styles.stat}>
          <LineCounts added={stat.added} removed={stat.removed} />
          {stat.status && <StatusLetter status={stat.status} />}
        </span>
      )}
    </button>
  );
}

function Nodes({ nodes, closed, onToggle, ...file }: FileProps & { nodes: FileNode[]; closed: ReadonlySet<string>; onToggle: (path: string) => void }) {
  return nodes.map((n) =>
    n.kind === "file" ? (
      <li key={`file:${n.path}`}>
        <FileButton path={n.path} name={n.name} {...file} />
      </li>
    ) : (
      <li key={`folder:${n.path}`}>
        <button type="button" className={styles.folder} aria-expanded={!closed.has(n.path)} title={n.path} onClick={() => onToggle(n.path)}>
          {closed.has(n.path) ? <ChevronRightIcon /> : <ChevronDownIcon />}
          <span className={styles.folderIcon}>
            <FolderIcon />
          </span>
          <span className={styles.name}>{n.name}</span>
          <span className={styles.count} aria-hidden>
            {n.fileCount}
          </span>
        </button>
        {!closed.has(n.path) && (
          <ul className={styles.children}>
            <Nodes nodes={n.children} closed={closed} onToggle={onToggle} {...file} />
          </ul>
        )}
      </li>
    ),
  );
}
