// projects FR-13: the subset of Markdown selo's planning files use, parsed to plain blocks that React renders as
// elements: never HTML, so a raw tag in a file shows as its text.

export type Inline = { kind: "text" | "code" | "bold"; text: string };

export interface ListItem {
  // null: no box; true or false: a ticked or empty box.
  checked: boolean | null;
  depth: number;
  inline: Inline[];
}

export type Block =
  | { kind: "heading"; level: number; inline: Inline[] }
  | { kind: "paragraph"; inline: Inline[] }
  | { kind: "list"; ordered: boolean; items: ListItem[] }
  | { kind: "table"; head: Inline[][]; rows: Inline[][][] }
  | { kind: "code"; text: string }
  | { kind: "rule" };

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const push = (kind: Inline["kind"], value: string) => {
    if (value === "") return;
    const last = out[out.length - 1];
    if (kind === "text" && last?.kind === "text") last.text += value;
    else out.push({ kind, text: value });
  };
  let i = 0;
  while (i < text.length) {
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i) {
        push("code", text.slice(i + 1, end));
        i = end + 1;
        continue;
      }
    }
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        push("bold", text.slice(i + 2, end).replace(/`/g, ""));
        i = end + 2;
        continue;
      }
    }
    // A link shows its text only: the panel navigates nowhere.
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(text.slice(i));
    if (link?.[1] !== undefined) {
      push("text", link[1]);
      i += link[0].length;
      continue;
    }
    push("text", text[i] ?? "");
    i += 1;
  }
  return out;
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => parseInline(cell.trim().replace(/\\\|/g, "|")));

const LIST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const TABLE_RULE = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", inline: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^\s*```/.test(line)) {
      flush();
      const code: string[] = [];
      for (i += 1; i < lines.length && !/^\s*```/.test(lines[i] ?? ""); i++) code.push(lines[i] ?? "");
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading?.[1] && heading[2] !== undefined) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length, inline: parseInline(heading[2].trim()) });
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      blocks.push({ kind: "rule" });
      continue;
    }
    if (line.trimStart().startsWith("|") && TABLE_RULE.test(lines[i + 1] ?? "")) {
      flush();
      const head = splitRow(line);
      const rows: Inline[][][] = [];
      for (i += 2; i < lines.length && (lines[i] ?? "").trimStart().startsWith("|"); i++) rows.push(splitRow(lines[i] ?? ""));
      i -= 1;
      blocks.push({ kind: "table", head, rows });
      continue;
    }
    const item = LIST.exec(line);
    if (item) {
      flush();
      const ordered = /\d/.test(item[2] ?? "");
      const last = blocks[blocks.length - 1];
      const list = last?.kind === "list" && last.ordered === ordered ? last : { kind: "list" as const, ordered, items: [] as ListItem[] };
      if (list !== last) blocks.push(list);
      const box = /^\[( |x|X)\]\s+(.*)$/.exec(item[3] ?? "");
      list.items.push({
        checked: box ? box[1] !== " " : null,
        depth: Math.floor((item[1] ?? "").replace(/\t/g, "  ").length / 2),
        inline: parseInline(box ? (box[2] ?? "") : (item[3] ?? "")),
      });
      continue;
    }
    // A line that follows a list item, indented, goes on with that item.
    const last = blocks[blocks.length - 1];
    if (paragraph.length === 0 && last?.kind === "list" && /^\s+\S/.test(line)) {
      const lastItem = last.items[last.items.length - 1];
      if (lastItem) {
        const [first, ...rest] = parseInline(` ${line.trim()}`);
        const tail = lastItem.inline[lastItem.inline.length - 1];
        if (first?.kind === "text" && tail?.kind === "text") tail.text += first.text;
        else if (first) lastItem.inline.push(first);
        lastItem.inline.push(...rest);
      }
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}
