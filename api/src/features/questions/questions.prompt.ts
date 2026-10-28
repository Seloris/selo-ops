// The run's instructions (`question` BR-02, BR-03): written in English, the answer asked in French.

export const PRESETS = ["explain"] as const;
export type Preset = (typeof PRESETS)[number];
export const TARGET_KINDS = ["blueprint", "sheet", "specs", "project"] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

const PRESET_INSTRUCTIONS: Record<Preset, string> = {
  explain: "Explain quickly, in plain words, what this file says and why. Keep it brief.",
};

const TARGETS: Record<TargetKind, string> = {
  blueprint: "the selo blueprint",
  sheet: "the selo spec (a page spec or a domain sheet)",
  specs: "all the selo specs of the project: every page spec under `.planning/pages/` and every domain sheet under `.planning/domain/`; read them all and answer from them",
  project: "the whole project",
};

export function promptOf({ kind, path, preset, text }: { kind: TargetKind; path: string | null; preset: Preset | null; text: string | null }): string {
  const target = path === null ? TARGETS[kind] : `${TARGETS[kind]} at \`${path}\``;
  const question = preset === null ? (text ?? "") : PRESET_INSTRUCTIONS[preset];
  return [
    "You answer one question about the software project in the current directory.",
    "You only read: use Read, Grep and Glob to look at its files. Never write or edit a file, never run a command.",
    `The question is about ${target}.`,
    "",
    "Question:",
    question,
    "",
    "Answer in French, in Markdown, without preamble.",
  ].join("\n");
}
