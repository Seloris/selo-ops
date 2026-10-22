import { describe, expect, it } from "vitest";
import { buildFileTree, type FileNode } from "./fileTree.ts";

const names = (nodes: FileNode[]): unknown[] =>
  nodes.map((n) => (n.kind === "folder" ? { [n.name]: names(n.children) } : n.name));

describe("buildFileTree", () => {
  it("returns nothing for no file", () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it("groups files under their folders, folders first, then by name", () => {
    const tree = buildFileTree(["web/b.ts", "api/z.ts", "README.md", "api/a.ts"]);
    expect(names(tree)).toEqual([{ api: ["a.ts", "z.ts"] }, { web: ["b.ts"] }, "README.md"]);
  });

  it("joins a chain of folders that hold a single folder", () => {
    const tree = buildFileTree(["api/src/features/sessions/a.ts", "api/src/features/sessions/b.ts", "api/test/c.ts"]);
    expect(names(tree)).toEqual([{ api: [{ "src/features/sessions": ["a.ts", "b.ts"] }, { test: ["c.ts"] }] }]);
  });

  it("keeps the whole path of each file and each folder", () => {
    const [folder] = buildFileTree(["api/src/a.ts"]);
    expect(folder).toMatchObject({ kind: "folder", name: "api/src", path: "api/src" });
    expect(folder?.kind === "folder" && folder.children[0]).toMatchObject({ kind: "file", name: "a.ts", path: "api/src/a.ts" });
  });

  it("reads Windows separators and drops duplicates", () => {
    expect(names(buildFileTree(["api\\a.ts", "api/a.ts"]))).toEqual([{ api: ["a.ts"] }]);
  });

  it("drops `.` and empty segments, and an entry ending with a slash", () => {
    expect(names(buildFileTree(["./a/c.ts", "a//d.ts", "/a/e.ts", "x/"]))).toEqual([{ a: ["c.ts", "d.ts", "e.ts"] }]);
  });

  it("keeps a file and a folder of the same name apart", () => {
    const tree = buildFileTree(["a", "a/b.ts"]);
    expect(tree.map((n) => `${n.kind}:${n.path}`)).toEqual(["folder:a", "file:a"]);
  });

  it("counts the files under each folder", () => {
    const [folder] = buildFileTree(["api/a.ts", "api/src/b.ts", "api/src/c.ts"]);
    expect(folder?.kind === "folder" && folder.fileCount).toBe(3);
  });
});
