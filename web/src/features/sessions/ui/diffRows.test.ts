import { describe, expect, it } from "vitest";
import { diffRows, diffStats, sideBySide } from "./diffRows.ts";

const DIFF = [
  "diff --git a/src/a.ts b/src/a.ts",
  "index 1111111..2222222 100644",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -12,3 +12,3 @@ import x",
  " one",
  "+two",
  " three",
  "-four",
  "@@ -63,2 +64,2 @@ export function f() {",
  "-old",
  "+new",
  " end",
  "\\ No newline at end of file",
  "",
].join("\n");

describe("diffRows", () => {
  it("numbers each line in the file before and after, without its sign", () => {
    // Act
    const rows = diffRows(DIFF);

    // Assert
    expect(rows.slice(0, 5)).toEqual([
      { kind: "hunk", text: "@@ -12,3 +12,3 @@ import x" },
      { kind: "context", text: "one", old: 12, new: 12 },
      { kind: "add", text: "two", old: null, new: 13 },
      { kind: "context", text: "three", old: 13, new: 14 },
      { kind: "remove", text: "four", old: 14, new: null },
    ]);
  });

  it("drops git's header lines and folds the unchanged lines between two hunks", () => {
    // Act
    const rows = diffRows(DIFF);

    // Assert
    expect(rows.some((r) => r.kind === "meta" && r.text.startsWith("diff "))).toBe(false);
    expect(rows[5]).toEqual({ kind: "gap", count: 48 });
    expect(rows[6]).toEqual({ kind: "hunk", text: "@@ -63,2 +64,2 @@ export function f() {" });
    expect(rows.at(-1)).toEqual({ kind: "meta", text: "\\ No newline at end of file" });
  });

  it("keeps the header lines of a part with no hunk, a binary file's", () => {
    // Act
    const rows = diffRows("diff --git a/logo.png b/logo.png\nBinary files /dev/null and b/logo.png differ\n");

    // Assert
    expect(rows).toEqual([
      { kind: "meta", text: "diff --git a/logo.png b/logo.png" },
      { kind: "meta", text: "Binary files /dev/null and b/logo.png differ" },
    ]);
  });

  it("reads a hunk header without counts as one line", () => {
    // Act
    const rows = diffRows("@@ -1 +1 @@\n-a\n+b\n@@ -5 +5 @@\n-c\n+d\n");

    // Assert
    expect(rows[3]).toEqual({ kind: "gap", count: 3 });
  });
});

describe("diffStats", () => {
  it("counts the lines a part adds and removes", () => {
    // Act / Assert
    expect(diffStats(DIFF)).toEqual({ added: 2, removed: 2 });
    expect(diffStats("")).toEqual({ added: 0, removed: 0 });
  });
});

describe("sideBySide", () => {
  it("faces a run of removed lines with the added lines after it", () => {
    // Act
    const rows = sideBySide(diffRows("@@ -1,3 +1,2 @@\n-a\n-b\n+c\n x\n"));

    // Assert
    expect(rows).toEqual([
      { kind: "full", row: { kind: "hunk", text: "@@ -1,3 +1,2 @@" } },
      { kind: "pair", left: { kind: "remove", text: "a", old: 1, new: null }, right: { kind: "add", text: "c", old: null, new: 1 } },
      { kind: "pair", left: { kind: "remove", text: "b", old: 2, new: null }, right: null },
      { kind: "pair", left: { kind: "context", text: "x", old: 3, new: 2 }, right: { kind: "context", text: "x", old: 3, new: 2 } },
    ]);
  });

  it("leaves an added line with no removed one facing nothing", () => {
    // Act
    const rows = sideBySide(diffRows("@@ -1 +1,2 @@\n x\n+y\n"));

    // Assert
    expect(rows[2]).toEqual({ kind: "pair", left: null, right: { kind: "add", text: "y", old: null, new: 2 } });
  });
});
