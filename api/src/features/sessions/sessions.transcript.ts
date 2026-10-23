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

// A run's prompt sits at the export's offset into the transcript; its head is enough, an image's data follows it.
function readImagePrompt(path: string, from: number): boolean {
  let head: string;
  try {
    const fd = openSync(path, "r");
    try {
      const buffer = Buffer.alloc(HEAD_BYTES);
      const length = readSync(fd, buffer, 0, HEAD_BYTES, from);
      head = buffer.toString("utf8", 0, length);
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
  // The line may be cut inside the image's data: matched as text, never parsed.
  const prompt = head.split("\n").find((line) => line.includes('"role":"user"'));
  return prompt !== undefined && prompt.includes('"content":[{"type":"image"');
}

export type ImagePromptReader = (path: string, from: number) => boolean;

// `session` BR-10: a prompt with no text whose first block is an image. A run's prompt never changes: each is read once.
export function createImagePromptReader(): ImagePromptReader {
  const known = new Map<string, boolean>();
  return (path, from) => {
    const key = `${path}:${from}`;
    let isImage = known.get(key);
    if (isImage === undefined) {
      isImage = readImagePrompt(path, from);
      known.set(key, isImage);
    }
    return isImage;
  };
}
