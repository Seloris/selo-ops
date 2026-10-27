import { useMemo, useState, type ComponentType } from "react";
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

function FileKindIcon({ path }: { path: string }) {
  const Icon = iconByKind[fileKind(path)];
  return <Icon />;
}

// The files a session modified, browsed folder by folder (sessions-live FR-19): every folder starts open,
// each file with the icon of its type; a click on a file asks for its diff (FR-51).
export function FileTree({ paths, selected, onSelect }: { paths: string[]; selected: string | null; onSelect: (path: string) => void }) {
  const tree = useMemo(() => buildFileTree(paths), [paths]);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (path: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  return <Nodes nodes={tree} closed={closed} onToggle={toggle} selected={selected} onSelect={onSelect} isRoot />;
}

function Nodes({
  nodes,
  closed,
  onToggle,
  selected,
  onSelect,
  isRoot = false,
}: {
  nodes: FileNode[];
  closed: ReadonlySet<string>;
  onToggle: (path: string) => void;
  selected: string | null;
  onSelect: (path: string) => void;
  isRoot?: boolean;
}) {
  return (
    <ul className={isRoot ? styles.tree : styles.children}>
      {nodes.map((n) =>
        n.kind === "file" ? (
          <li key={`file:${n.path}`}>
            <button type="button" className={`${styles.file} ${n.path === selected ? styles.selected : ""}`} aria-pressed={n.path === selected} title={n.path} onClick={() => onSelect(n.path)}>
              <FileKindIcon path={n.path} />
              <span className={styles.name}>{n.name}</span>
            </button>
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
            {!closed.has(n.path) && <Nodes nodes={n.children} closed={closed} onToggle={onToggle} selected={selected} onSelect={onSelect} />}
          </li>
        ),
      )}
    </ul>
  );
}
