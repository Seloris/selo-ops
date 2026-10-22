// The type of a file the session modified, read from its extension, so the file tree shows an icon for it
// (sessions-live FR-19). An unknown extension, or a name with none (`Dockerfile`, `.gitignore`), is a plain file.

export type FileKind = "markdown" | "typescript" | "react" | "javascript" | "json" | "style" | "html" | "yaml" | "image" | "shell" | "text" | "file";

const kindByExtension = new Map<string, FileKind>(Object.entries({
  md: "markdown",
  mdx: "markdown",
  markdown: "markdown",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "react",
  jsx: "react",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  css: "style",
  scss: "style",
  sass: "style",
  less: "style",
  html: "html",
  htm: "html",
  yaml: "yaml",
  yml: "yaml",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  svg: "image",
  webp: "image",
  ico: "image",
  sh: "shell",
  bash: "shell",
  ps1: "shell",
  cmd: "shell",
  bat: "shell",
  txt: "text",
  log: "text",
}) as [string, FileKind][]);

export function fileKind(path: string): FileKind {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "file";
  return kindByExtension.get(name.slice(dot + 1).toLowerCase()) ?? "file";
}
