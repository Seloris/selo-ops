import { describe, expect, it } from "vitest";
import { diffLines } from "./diffLines.ts";

describe("diffLines", () => {
  it("tells added, removed, hunk, header and context lines apart", () => {
    const text = [
      "diff --git a/src/a.ts b/src/a.ts",
      "index 1111111..2222222 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,2 +1,2 @@",
      " keep",
      "-export const a = 1;",
      "+export const a = 2;",
      "\\ No newline at end of file",
      "",
    ].join("\n");

    expect(diffLines(text)).toEqual([
      { kind: "meta", text: "diff --git a/src/a.ts b/src/a.ts" },
      { kind: "meta", text: "index 1111111..2222222 100644" },
      { kind: "meta", text: "--- a/src/a.ts" },
      { kind: "meta", text: "+++ b/src/a.ts" },
      { kind: "hunk", text: "@@ -1,2 +1,2 @@" },
      { kind: "context", text: " keep" },
      { kind: "remove", text: "-export const a = 1;" },
      { kind: "add", text: "+export const a = 2;" },
      { kind: "meta", text: "\\ No newline at end of file" },
    ]);
  });

  it("reads a removed line starting with dashes inside a hunk as removed", () => {
    expect(diffLines("@@ -1 +1 @@\n--- old rule\n+++ new rule\n")).toEqual([
      { kind: "hunk", text: "@@ -1 +1 @@" },
      { kind: "remove", text: "--- old rule" },
      { kind: "add", text: "+++ new rule" },
    ]);
  });

  it("drops the carriage returns of a Windows file", () => {
    expect(diffLines("@@ -1 +1 @@\r\n-a\r\n+b\r\n")).toEqual([
      { kind: "hunk", text: "@@ -1 +1 @@" },
      { kind: "remove", text: "-a" },
      { kind: "add", text: "+b" },
    ]);
  });

  it("gives nothing for an empty diff", () => {
    expect(diffLines("")).toEqual([]);
  });
});
