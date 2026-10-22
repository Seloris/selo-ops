import { useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, FileIcon, FolderIcon } from "../../../shared/ui/icons.tsx";
import { buildFileTree, type FileNode } from "./fileTree.ts";
import styles from "./FileTree.module.css";

// The files a session touched, browsed folder by folder (sessions-live FR-19): every folder starts open.
export function FileTree({ paths }: { paths: string[] }) {
  const tree = useMemo(() => buildFileTree(paths), [paths]);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (path: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  return <Nodes nodes={tree} closed={closed} onToggle={toggle} isRoot />;
}

function Nodes({ nodes, closed, onToggle, isRoot = false }: { nodes: FileNode[]; closed: ReadonlySet<string>; onToggle: (path: string) => void; isRoot?: boolean }) {
  return (
    <ul className={isRoot ? styles.tree : styles.children}>
      {nodes.map((n) =>
        n.kind === "file" ? (
          <li key={`file:${n.path}`} className={styles.file} title={n.path}>
            <FileIcon />
            <span className={styles.name}>{n.name}</span>
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
            {!closed.has(n.path) && <Nodes nodes={n.children} closed={closed} onToggle={onToggle} />}
          </li>
        ),
      )}
    </ul>
  );
}
