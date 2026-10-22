import { describe, expect, it } from "vitest";
import { fileKind } from "./fileKind.ts";

describe("fileKind", () => {
  it.each([
    ["README.md", "markdown"],
    ["docs/guide.mdx", "markdown"],
    ["src/app.ts", "typescript"],
    ["src/api/schema.d.ts", "typescript"],
    ["vite.config.mts", "typescript"],
    ["src/FileTree.tsx", "react"],
    ["src/App.jsx", "react"],
    ["selo-run.mjs", "javascript"],
    ["index.js", "javascript"],
    ["package.json", "json"],
    ["src/FileTree.module.css", "style"],
    ["index.html", "html"],
    ["selo.yaml", "yaml"],
    [".github/workflows/ci.yml", "yaml"],
    ["logo.svg", "image"],
    ["shot.PNG", "image"],
    ["scripts/setup.sh", "shell"],
    ["build.ps1", "shell"],
    ["notes.txt", "text"],
  ])("%s is %s", (path, kind) => {
    expect(fileKind(path)).toBe(kind);
  });

  it("falls back to a plain file for an unknown extension", () => {
    expect(fileKind("data.bin")).toBe("file");
  });

  it("falls back to a plain file when the name has no extension", () => {
    expect(fileKind("Dockerfile")).toBe("file");
    expect(fileKind(".gitignore")).toBe("file");
    expect(fileKind("web/.env")).toBe("file");
    expect(fileKind("a.constructor")).toBe("file");
  });

  it("reads the extension of the file's name, not of its folders", () => {
    expect(fileKind("docs.md/LICENSE")).toBe("file");
  });
});
