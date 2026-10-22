import { closeSync, openSync, readSync } from "node:fs";

// The first dated line sits in the transcript's first lines; its head only is read, never the megabytes after it.
const HEAD_BYTES = 16 * 1024;

// When Claude Code wrote the transcript's first dated line: the session's creation (`session` BR-15). Null when the file
// is gone or holds no date in its head; its last line may be cut, it then fails to parse.
function readStart(path: string): number | null {
  let head: string;
  try {
    const fd = openSync(path, "r");
    try {
      const buffer = Buffer.alloc(HEAD_BYTES);
      const length = readSync(fd, buffer, 0, HEAD_BYTES, 0);
      head = buffer.toString("utf8", 0, length);
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
  for (const line of head.split("\n")) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof value !== "object" || value === null || !("timestamp" in value) || typeof value.timestamp !== "string") continue;
    const at = Date.parse(value.timestamp);
    if (Number.isFinite(at)) return at;
  }
  return null;
}

export type TranscriptStartReader = (path: string) => number | null;

// A transcript's first line never changes once written: a date found is kept, so the 5 s poll opens each file once.
// A head with no date yet is read again, a session that just started writes it soon.
export function createTranscriptStartReader(): TranscriptStartReader {
  const starts = new Map<string, number>();
  return (path) => {
    const known = starts.get(path);
    if (known !== undefined) return known;
    const start = readStart(path);
    if (start !== null) starts.set(path, start);
    return start;
  };
}
