// The files a session modified, as a tree of folders to browse (sessions-live FR-19). The export gives paths
// relative to the repository; `.` and empty segments are dropped, and an entry ending with a slash names no file.

export type FileNode =
  | { kind: "file"; name: string; path: string }
  | { kind: "folder"; name: string; path: string; fileCount: number; children: FileNode[] };

type Draft = { folders: Map<string, Draft>; files: Set<string> };

const newDraft = (): Draft => ({ folders: new Map(), files: new Set() });

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

function toNodes(draft: Draft, prefix: string): FileNode[] {
  const folders = [...draft.folders].map(([name, child]) => toFolder(name, child, prefix));
  const files = [...draft.files].map((name) => ({ kind: "file" as const, name, path: prefix + name }));
  return [...folders.sort(byName), ...files.sort(byName)];
}

function toFolder(name: string, draft: Draft, prefix: string): FileNode {
  // A folder that holds one folder and no file is joined with it: `src/features/sessions` reads as one step.
  let label = name;
  let current = draft;
  while (current.files.size === 0 && current.folders.size === 1) {
    const [childName, child] = current.folders.entries().next().value as [string, Draft];
    label = `${label}/${childName}`;
    current = child;
  }
  const path = prefix + label;
  const children = toNodes(current, `${path}/`);
  const fileCount = children.reduce((sum, c) => sum + (c.kind === "file" ? 1 : c.fileCount), 0);
  return { kind: "folder", name: label, path, fileCount, children };
}

export function buildFileTree(paths: string[]): FileNode[] {
  const root = newDraft();
  for (const raw of paths) {
    const path = raw.replaceAll("\\", "/");
    if (path.endsWith("/")) continue;
    const parts = path.split("/").filter((part) => part !== "" && part !== ".");
    const file = parts.pop();
    if (!file) continue;
    let draft = root;
    for (const part of parts) {
      let child = draft.folders.get(part);
      if (!child) {
        child = newDraft();
        draft.folders.set(part, child);
      }
      draft = child;
    }
    draft.files.add(file);
  }
  return toNodes(root, "");
}

// The files in the order the tree shows them, folders first (sessions-live FR-56's « ‹ 2 / 3 › »).
export function orderedFiles(nodes: FileNode[]): string[] {
  return nodes.flatMap((n) => (n.kind === "file" ? [n.path] : orderedFiles(n.children)));
}

// Every folder of the tree, for « Tout replier » (sessions-live FR-55).
export function folderPaths(nodes: FileNode[]): string[] {
  return nodes.flatMap((n) => (n.kind === "file" ? [] : [n.path, ...folderPaths(n.children)]));
}

// « Filtrer les fichiers… »: the paths that hold the text typed, whatever its case (sessions-live FR-55).
export function filterPaths(paths: string[], query: string): string[] {
  const text = query.trim().toLowerCase();
  return text === "" ? paths : paths.filter((p) => p.toLowerCase().includes(text));
}
