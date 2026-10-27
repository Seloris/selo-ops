import { diffLines } from "./diffLines.ts";

// A line of code in a part of a file's diff (sessions-live FR-56): its text without its sign, numbered in the file
// before (`old`) and after (`new`).
export interface CodeRow {
  kind: "context" | "add" | "remove";
  text: string;
  old: number | null;
  new: number | null;
}

export type DiffRow =
  | CodeRow
  | { kind: "hunk"; text: string }
  // The unchanged lines between two hunks, folded.
  | { kind: "gap"; count: number }
  | { kind: "meta"; text: string };

// One line of « Côte à côte »: the file before on the left, after on the right; a hunk, a gap or a note across both.
export type SideRow = { kind: "pair"; left: CodeRow | null; right: CodeRow | null } | { kind: "full"; row: Exclude<DiffRow, CodeRow> };

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

// git's header lines (`diff --git`, `index`, `---`, `+++`) are dropped once the part has a hunk; without one (a binary
// file), they are all it says.
export function diffRows(text: string): DiffRow[] {
  const lines = diffLines(text);
  const hasHunk = lines.some((l) => l.kind === "hunk");
  const rows: DiffRow[] = [];
  let isInHunk = false;
  let oldLine = 0;
  let newLine = 0;
  let previousEnd: number | null = null;
  for (const line of lines) {
    if (line.kind === "hunk") {
      const match = HUNK.exec(line.text);
      isInHunk = match !== null;
      if (match) {
        const oldStart = Number(match[1]);
        const oldCount = match[2] === undefined ? 1 : Number(match[2]);
        if (previousEnd !== null && oldStart > previousEnd) rows.push({ kind: "gap", count: oldStart - previousEnd });
        previousEnd = oldStart + oldCount;
        oldLine = oldStart;
        newLine = Number(match[3]);
      }
      rows.push({ kind: "hunk", text: line.text });
      continue;
    }
    if (line.kind === "meta") {
      if (line.text.startsWith("diff ")) isInHunk = false;
      if (!hasHunk || (isInHunk && line.text.startsWith("\\"))) rows.push({ kind: "meta", text: line.text });
      continue;
    }
    const body = line.text.slice(1);
    if (line.kind === "add") rows.push({ kind: "add", text: body, old: null, new: newLine++ });
    else if (line.kind === "remove") rows.push({ kind: "remove", text: body, old: oldLine++, new: null });
    else rows.push({ kind: "context", text: body, old: oldLine++, new: newLine++ });
  }
  return rows;
}

// The lines a part adds and removes, for its chip and its title.
export function diffStats(text: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const row of diffRows(text)) {
    if (row.kind === "add") added++;
    else if (row.kind === "remove") removed++;
  }
  return { added, removed };
}

export const isCode = (row: DiffRow): row is CodeRow => row.kind === "context" || row.kind === "add" || row.kind === "remove";

// A run of removed lines faces the run of added lines right after it, line by line; the longer run's rest faces nothing.
export function sideBySide(rows: DiffRow[]): SideRow[] {
  const out: SideRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (row === undefined) break;
    if (!isCode(row)) {
      out.push({ kind: "full", row });
      i++;
      continue;
    }
    if (row.kind === "context") {
      out.push({ kind: "pair", left: row, right: row });
      i++;
      continue;
    }
    const removed: CodeRow[] = [];
    const added: CodeRow[] = [];
    while (rows[i]?.kind === "remove") removed.push(rows[i++] as CodeRow);
    while (rows[i]?.kind === "add") added.push(rows[i++] as CodeRow);
    for (let k = 0; k < Math.max(removed.length, added.length); k++) out.push({ kind: "pair", left: removed[k] ?? null, right: added[k] ?? null });
  }
  return out;
}
