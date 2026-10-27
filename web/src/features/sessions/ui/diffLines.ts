export type DiffLineKind = "add" | "remove" | "hunk" | "meta" | "context";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

// A unified diff as git prints it, line by line (sessions-live FR-51). Before the first hunk every line is a header,
// so a removed line that starts with `---` inside a hunk stays a removed line.
export function diffLines(text: string): DiffLine[] {
  const lines = text.replace(/\r?\n$/, "").split(/\r?\n/);
  if (lines.length === 1 && lines[0] === "") return [];
  let isInHunk = false;
  return lines.map((line) => {
    if (line.startsWith("diff ")) isInHunk = false;
    if (line.startsWith("@@")) {
      isInHunk = true;
      return { kind: "hunk", text: line };
    }
    if (!isInHunk || line.startsWith("\\")) return { kind: "meta", text: line };
    if (line.startsWith("+")) return { kind: "add", text: line };
    if (line.startsWith("-")) return { kind: "remove", text: line };
    return { kind: "context", text: line };
  });
}
