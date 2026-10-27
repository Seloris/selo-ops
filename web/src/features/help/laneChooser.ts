import type { MessageKey } from "../../shared/lib/i18n/index.ts";
import type { ColourId, LaneId } from "./content.ts";

// help FR-02, FR-03, FR-20: three questions pick a lane, its exact prompts and the flow they run.

export type Stay = "stay" | "leave";
export type Scope = "page" | "new";
export type Preview = "direct" | "mockup" | "iterate";

export interface Answers {
  stay?: Stay;
  scope?: Scope;
  preview?: Preview;
}

export type Question = keyof Answers;

// Leaving hands the lane to selo: the scope no longer matters.
export const isScopeOpen = (answers: Answers) => answers.stay !== "leave";

// Iterating needs the person at the running app, on the fastlane.
export const isPreviewAllowed = (answers: Answers, preview: Preview) => preview !== "iterate" || (answers.stay !== "leave" && answers.scope !== "new");

export function isAnswered(answers: Answers, question: Question): boolean {
  if (question === "scope") return isScopeOpen(answers) && answers.scope !== undefined;
  return answers[question] !== undefined;
}

// A new answer drops a preview it rules out, so the result never rests on a closed choice.
export function answer(answers: Answers, patch: Answers): Answers {
  const next = { ...answers, ...patch };
  if (next.preview && !isPreviewAllowed(next, next.preview)) delete next.preview;
  return next;
}

export function previewHint(answers: Answers, preview: Preview): MessageKey | undefined {
  if (preview === "iterate") {
    if (answers.stay === "leave") return "help.lanes.preview.iterate.stayOnly";
    if (answers.scope === "new") return "help.lanes.preview.iterate.fastlaneOnly";
    return "help.lanes.preview.iterate.hint";
  }
  if (preview === "mockup") return answers.stay === "leave" ? "help.lanes.preview.mockup.leave" : "help.lanes.preview.mockup.hint";
  return undefined;
}

export type StepState = "on" | "skip" | "you";

export interface TrackStep {
  name: MessageKey;
  hint: MessageKey;
  state: StepState;
  code?: string;
  // The loop a step turns in, shown above it.
  loop?: boolean;
}

export interface Track {
  colour: ColourId;
  name: MessageKey;
  steps: TrackStep[];
  // The line that hands this track's outcome to the next one.
  join?: { text: MessageKey; code?: string };
}

export interface LanePrompt {
  command: string;
  // The line before it: what must be done first.
  then?: MessageKey;
  colour?: ColourId;
}

export interface LaneResult {
  lane: LaneId;
  name: MessageKey;
  options: { label: string; colour: ColourId }[];
  why: MessageKey[];
  prompts: LanePrompt[];
  text: MessageKey;
  tracks: Track[];
  foot: MessageKey;
}

const mockupPath = "--mockup .planning/mockups/{fichier}";

const step = (id: string, state: StepState, hint = `help.lanes.step.${id}.hint`, extra: Partial<TrackStep> = {}): TrackStep => ({
  name: `help.lanes.step.${id}.name` as MessageKey,
  hint: hint as MessageKey,
  state,
  ...extra,
});

const request = (code: string, hint: MessageKey = "help.lanes.step.request.hint") => step("request", "you", hint, { code });

const mockupTrack: Track = {
  colour: "mockup",
  name: "help.lanes.track.mockup",
  steps: [
    request("/selo:mockup {demande}", "help.lanes.step.request.mockup"),
    step("draft", "on"),
    step("touchUp", "on", undefined, { loop: true }),
    step("validate", "you", "help.lanes.step.validate.mockup"),
  ],
  join: { text: "help.lanes.join.mockup", code: "--mockup {fichier}" },
};

const iterateTrack: Track = {
  colour: "iterate",
  name: "help.lanes.track.iterate",
  steps: [request("/selo:fastlane {demande} --iterate", "help.lanes.step.request.iterate"), step("change", "on", undefined, { loop: true }), step("validate", "you", "help.lanes.step.validate.iterate")],
  join: { text: "help.lanes.join.iterate" },
};

const browser = (preview: Preview) => step("browser", "on", preview === "mockup" ? "help.lanes.step.browser.mockup" : "help.lanes.step.browser.hint");

function fastlaneTrack(preview: Preview): Track {
  return {
    colour: "fastlane",
    name: "help.lanes.fastlane.name",
    steps: [
      ...(preview === "direct" ? [request("/selo:fastlane {demande}")] : []),
      step("grill", "skip", "help.lanes.step.grill.skip"),
      step("blueprint", "skip", "help.lanes.step.blueprint.skip"),
      step("approval", "skip", "help.lanes.step.approval.skip"),
      step("stages", "on", "help.lanes.step.stages.fastlane"),
      step("review", "on"),
      step("suites", "on"),
      browser(preview),
      step("specMerged", "skip", "help.lanes.step.specMerged.skip"),
      step("footer", "you", "help.lanes.step.footer.fastlane"),
    ],
  };
}

function blueprintTrack(preview: Preview): Track {
  return {
    colour: "blueprint",
    name: "help.lanes.blueprint.name",
    steps: [
      ...(preview === "direct" ? [request("/selo:blueprint {demande}")] : []),
      step("grill", "on"),
      step("blueprint", "on"),
      step("approval", "you"),
      step("stages", "on"),
      step("review", "on"),
      step("suites", "on"),
      browser(preview),
      step("specMerged", "on"),
      step("footer", "on"),
    ],
  };
}

function pilotTrack(preview: Preview): Track {
  return {
    colour: "pilot",
    name: "help.lanes.pilot.name",
    steps: [
      preview === "mockup" ? step("leave", "you") : request("/selo:pilot {demande} --autonomous", "help.lanes.step.request.pilot"),
      step("grill", "on", "help.lanes.step.grill.pilot"),
      step("blueprint", "on"),
      step("approval", "skip", "help.lanes.step.approval.pilot"),
      step("stages", "on", "help.lanes.step.stages.pilot"),
      step("review", "on"),
      step("suites", "on"),
      browser(preview),
      step("specMerged", "on"),
      step("footer", "on"),
    ],
  };
}

const whyPreview: Record<Preview, MessageKey> = { direct: "help.lanes.why.direct", mockup: "help.lanes.why.mockup", iterate: "help.lanes.why.iterate" };

// The lane for complete answers, null while one is missing.
export function laneFor(answers: Answers): LaneResult | null {
  const { stay, scope, preview } = answers;
  if (!stay || !preview || !isPreviewAllowed(answers, preview)) return null;
  const drawFirst: LanePrompt[] = preview === "mockup" ? [{ command: "/selo:mockup {demande}", colour: "mockup" }] : [];
  const afterMockup: MessageKey | undefined = preview === "mockup" ? "help.lanes.then.mockup" : undefined;
  const mockupOption = preview === "mockup" ? [{ label: "--mockup", colour: "mockup" as const }] : [];

  if (stay === "leave") {
    return {
      lane: "pilot",
      name: "help.lanes.pilot.name",
      options: [...mockupOption, { label: "--autonomous", colour: "pilot" }],
      why: ["help.lanes.why.leave", ...(preview === "mockup" ? [whyPreview.mockup] : [])],
      prompts: [...drawFirst, { command: `/selo:pilot {demande}${preview === "mockup" ? ` ${mockupPath}` : ""} --autonomous`, then: afterMockup }],
      text: preview === "mockup" ? "help.lanes.text.pilotMockup" : "help.lanes.text.pilot",
      tracks: [...(preview === "mockup" ? [mockupTrack] : []), pilotTrack(preview)],
      foot: "help.lanes.foot.pilot",
    };
  }
  if (!scope) return null;
  const why: MessageKey[] = ["help.lanes.why.stay", scope === "page" ? "help.lanes.why.page" : "help.lanes.why.new", whyPreview[preview]];
  const withMockup = preview === "mockup" ? ` ${mockupPath}` : "";

  if (scope === "page") {
    return {
      lane: "fastlane",
      name: "help.lanes.fastlane.name",
      options: preview === "iterate" ? [{ label: "--iterate", colour: "iterate" }] : mockupOption,
      why,
      prompts: [...drawFirst, { command: `/selo:fastlane {demande}${preview === "iterate" ? " --iterate" : withMockup}`, then: afterMockup }],
      text: `help.lanes.text.fastlane.${preview}`,
      tracks: [...(preview === "mockup" ? [mockupTrack] : preview === "iterate" ? [iterateTrack] : []), fastlaneTrack(preview)],
      foot: "help.lanes.foot.worktree",
    };
  }
  return {
    lane: "blueprint",
    name: "help.lanes.blueprint.name",
    options: mockupOption,
    why,
    prompts: [...drawFirst, { command: `/selo:blueprint {demande}${withMockup}`, then: afterMockup }, { command: "/selo:build {blueprint}", then: "help.lanes.then.build" }],
    text: preview === "mockup" ? "help.lanes.text.blueprint.mockup" : "help.lanes.text.blueprint.direct",
    tracks: [...(preview === "mockup" ? [mockupTrack] : []), blueprintTrack(preview)],
    foot: "help.lanes.foot.worktree",
  };
}

export interface PromptPart {
  text: string;
  isPlaceholder?: boolean;
  isOption?: boolean;
}

// A prompt cut for display: its `{placeholders}` and everything from its first option on, each marked.
export function splitPrompt(command: string): PromptPart[] {
  const at = command.indexOf(" --");
  const head = at < 0 ? command : command.slice(0, at + 1);
  const tail = at < 0 ? "" : command.slice(at + 1);
  const parts = (text: string, isOption: boolean): PromptPart[] =>
    text
      .split(/(\{[^}]+\})/)
      .filter(Boolean)
      .map((piece) => ({ text: piece, ...(isOption ? { isOption } : {}), ...(piece.startsWith("{") ? { isPlaceholder: true } : {}) }));
  return [...parts(head, false), ...parts(tail, true)];
}
