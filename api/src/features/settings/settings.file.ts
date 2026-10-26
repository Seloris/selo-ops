import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SeloSettings } from "./settings.schema.js";

// Claude Code's user settings file (`settings` BR-01): the one file outside its own data Selo Ops writes.

type JsonObject = Record<string, unknown>;
export type SettingsRead =
  | { state: "missing" }
  | { state: "unreadable"; error: NonNullable<SeloSettings["error"]> }
  | { state: "ok"; root: JsonObject };

export interface SettingsFile {
  path: string;
  read(): SettingsRead;
  write(root: JsonObject): void;
}

const isObject = (v: unknown): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);

// V8's message gives the line and column, or only the position, or nothing (an unexpected token): null then.
function positionOf(message: string, text: string): { line: number | null; column: number | null } {
  const lineColumn = /line (\d+) column (\d+)/.exec(message);
  if (lineColumn) return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };
  const position = /position (\d+)/.exec(message);
  const at = position ? Number(position[1]) : /end of JSON/.test(message) ? text.length : null;
  if (at === null) return { line: null, column: null };
  const before = text.slice(0, at);
  return { line: before.split("\n").length, column: at - before.lastIndexOf("\n") };
}

export function createSettingsFile(path: string): SettingsFile {
  return {
    path,
    read: () => {
      let text: string;
      try {
        // A BOM, as an editor on Windows may save it, is not a JSON error.
        text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
      } catch (err) {
        if (isObject(err) && err.code === "ENOENT") return { state: "missing" };
        throw err;
      }
      let root: unknown;
      try {
        root = JSON.parse(text);
      } catch (err) {
        return { state: "unreadable", error: { reason: "json", ...positionOf(err instanceof Error ? err.message : "", text) } };
      }
      if (!isObject(root)) return { state: "unreadable", error: { reason: "root", line: null, column: null } };
      if (root.env !== undefined && !isObject(root.env)) return { state: "unreadable", error: { reason: "env", line: null, column: null } };
      return { state: "ok", root };
    },
    // Replaced whole, atomically: Claude Code reads the file at any time, never half-written.
    write: (root) => {
      mkdirSync(dirname(path), { recursive: true });
      const temp = `${path}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temp, JSON.stringify(root, null, 2) + "\n");
        renameSync(temp, path);
      } catch (err) {
        rmSync(temp, { force: true });
        throw err;
      }
    },
  };
}
