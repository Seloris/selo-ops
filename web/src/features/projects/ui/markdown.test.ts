import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown.ts";

describe("parseInline", () => {
  it("splits inline code and bold from the text", () => {
    expect(parseInline("A **BR-01** in `todo` here")).toEqual([
      { kind: "text", text: "A " },
      { kind: "bold", text: "BR-01" },
      { kind: "text", text: " in " },
      { kind: "code", text: "todo" },
      { kind: "text", text: " here" },
    ]);
  });

  it("keeps a raw HTML tag as text", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([{ kind: "text", text: "<script>alert(1)</script>" }]);
  });

  it("keeps a lone backtick or star as text", () => {
    expect(parseInline("a ` b ** c")).toEqual([{ kind: "text", text: "a ` b ** c" }]);
  });

  it("shows a link's text only", () => {
    expect(parseInline("See [vat.ts](../api/vat.ts).")).toEqual([{ kind: "text", text: "See vat.ts." }]);
  });
});

describe("parseMarkdown", () => {
  it("reads titles and paragraphs, joining a paragraph's lines", () => {
    expect(parseMarkdown("# Title\n\nOne line\nnext line.\n\n## Zone")).toEqual([
      { kind: "heading", level: 1, inline: [{ kind: "text", text: "Title" }] },
      { kind: "paragraph", inline: [{ kind: "text", text: "One line next line." }] },
      { kind: "heading", level: 2, inline: [{ kind: "text", text: "Zone" }] },
    ]);
  });

  it("reads a list with ticked and empty boxes, nested items and continued lines", () => {
    const [list] = parseMarkdown("- [x] Stage 1 — api\n- [ ] Review\n  still review\n  - nested");
    expect(list).toEqual({
      kind: "list",
      ordered: false,
      items: [
        { checked: true, depth: 0, inline: [{ kind: "text", text: "Stage 1 — api" }] },
        { checked: false, depth: 0, inline: [{ kind: "text", text: "Review still review" }] },
        { checked: null, depth: 1, inline: [{ kind: "text", text: "nested" }] },
      ],
    });
  });

  it("reads an ordered list apart from a bullet list", () => {
    expect(parseMarkdown("1. api — `feat`\n2. web\n- other").map((b) => (b.kind === "list" ? [b.ordered, b.items.length] : b.kind))).toEqual([
      [true, 2],
      [false, 1],
    ]);
  });

  it("reads a table with its header and rows", () => {
    expect(parseMarkdown("| Term | Id |\n|---|---|\n| `todo` | Todo |\n| a \\| b | c |")).toEqual([
      {
        kind: "table",
        head: [[{ kind: "text", text: "Term" }], [{ kind: "text", text: "Id" }]],
        rows: [
          [[{ kind: "code", text: "todo" }], [{ kind: "text", text: "Todo" }]],
          [[{ kind: "text", text: "a | b" }], [{ kind: "text", text: "c" }]],
        ],
      },
    ]);
  });

  it("keeps a fenced block whole, Markdown inside included", () => {
    expect(parseMarkdown("```\n# not a title\n- not a list\n```")).toEqual([{ kind: "code", text: "# not a title\n- not a list" }]);
  });

  it("reads a rule, not an empty list", () => {
    expect(parseMarkdown("a\n\n---\n\nb").map((b) => b.kind)).toEqual(["paragraph", "rule", "paragraph"]);
  });

  it("reads Windows line ends", () => {
    expect(parseMarkdown("# A\r\n\r\nb\r\n").map((b) => b.kind)).toEqual(["heading", "paragraph"]);
  });
});
