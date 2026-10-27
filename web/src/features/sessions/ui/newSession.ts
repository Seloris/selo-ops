import type { components } from "../../../api/schema.d.ts";

export type ProjectOverview = components["schemas"]["ProjectOverview"];
export type Blueprint = components["schemas"]["Blueprint"];
export type Mockup = components["schemas"]["Mockup"];
export type SpecSheet = components["schemas"]["SpecSheet"];

// sessions-live FR-44: « Simple » asks what to do and whether the person stays; « Avancé » offers every skill and flag.
export type Mode = "simple" | "advanced";
// sessions-live FR-45: « Je reste là » runs the pilot with its questions, « Je m'absente » the autonomous pilot.
export type Presence = "stay" | "leave";

// sessions-live FR-46: what the « Avancé » mode offers, in its groups and order.
// `autonomous`: « Confier à l'agent », the pilot with `— autonomous`; `pilot`: « Laisser selo choisir la voie ».
export type SkillId = "autonomous" | "pilot" | "fastlane" | "mockup" | "blueprint" | "build" | "grill" | "review" | "try" | "free";
export type SkillGroup = "do" | "check" | "free";
export const SKILL_GROUPS: { group: SkillGroup; skills: SkillId[] }[] = [
  { group: "do", skills: ["autonomous", "pilot", "fastlane", "mockup", "blueprint", "build"] },
  { group: "check", skills: ["grill", "review", "try"] },
  { group: "free", skills: ["free"] },
];

export type PilotLane = "agent" | "fastlane" | "blueprint";

// sessions-live FR-45: a blueprint or a mockup picked in « Simple » to resume.
export interface Resume {
  kind: "blueprint" | "mockup";
  file: string;
}

export interface NewSessionForm {
  mode: Mode;
  presence: Presence;
  resume: Resume | null;
  skill: SkillId;
  request: string;
  // build, and an autonomous pilot started from a blueprint: the blueprint's file.
  blueprintFile: string | null;
  fromBlueprint: boolean;
  lane: PilotLane;
  untilBlueprint: boolean;
  iterate: boolean;
  noBrowser: boolean;
  // build: the one stage to run, null for all of them.
  stage: number | null;
  // « Ce que ça touche »: the spec files the request is about.
  touches: string[];
  // fastlane and blueprint: « Partir d'une maquette ».
  mockupFile: string | null;
}

export const EMPTY_FORM: NewSessionForm = {
  mode: "simple",
  presence: "stay",
  resume: null,
  skill: "autonomous",
  request: "",
  blueprintFile: null,
  fromBlueprint: false,
  lane: "agent",
  untilBlueprint: false,
  iterate: false,
  noBrowser: false,
  stage: null,
  touches: [],
  mockupFile: null,
};

// sessions-live FR-49: the mode and the choice made last, as the browser keeps them.
export const PREFS_KEY = "selo-ops/new-session";
export function parsePrefs(raw: unknown): { mode: Mode; presence: Presence } {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return { mode: r.mode === "advanced" ? "advanced" : "simple", presence: r.presence === "leave" ? "leave" : "stay" };
}

export const usesBlueprint = (f: NewSessionForm) => f.skill === "build" || (f.skill === "autonomous" && f.fromBlueprint);
export const isRequestOptional = (skill: SkillId) => skill === "review" || skill === "try";
export const hasNoBrowser = (skill: SkillId) => skill === "autonomous" || skill === "pilot" || skill === "fastlane" || skill === "build";
export const hasMockupOption = (skill: SkillId) => skill === "fastlane" || skill === "blueprint";

// The selo skill a choice runs: both pilot choices run `/selo-flow:pilot`.
export const seloSkillOf = (skill: SkillId) => (skill === "autonomous" ? "pilot" : skill);

// sessions-live FR-46, FR-47: each option a skill takes, as its selo flag; the mockup first, `— autonomous` last.
function flagsOf(f: NewSessionForm): string[] {
  const flags: string[] = [];
  if (hasMockupOption(f.skill) && f.mockupFile !== null) flags.push(`mockup ${f.mockupFile}`);
  if (f.skill === "autonomous" && !f.fromBlueprint) {
    if (f.lane !== "agent") flags.push(f.lane);
    if (f.untilBlueprint && f.lane !== "fastlane") flags.push("until blueprint");
  }
  if (f.skill === "fastlane" && f.iterate) flags.push("iterate");
  if (f.skill === "build" && f.stage !== null) flags.push(`stage ${f.stage}`);
  if (hasNoBrowser(f.skill) && f.noBrowser) flags.push("no browser");
  if (f.skill === "autonomous") flags.push("autonomous");
  return flags;
}

const joined = (parts: string[]) => parts.filter((part) => part !== "").join(" ");

// sessions-live FR-47: « Simple » runs the pilot, or builds a chosen blueprint while the person stays.
function simpleCommand(f: NewSessionForm): string {
  const leave = f.presence === "leave" ? ["— autonomous"] : [];
  if (f.resume?.kind === "blueprint") return f.presence === "leave" ? joined(["/selo-flow:pilot", f.resume.file, ...leave]) : `/selo-flow:build ${f.resume.file}`;
  const mockup = f.resume?.kind === "mockup" ? [`— mockup ${f.resume.file}`] : [];
  return joined(["/selo-flow:pilot", f.request.trim(), ...mockup, ...leave]);
}

export function commandOf(f: NewSessionForm): string {
  if (f.mode === "simple") return simpleCommand(f);
  const subject = usesBlueprint(f) ? (f.blueprintFile ?? "") : joined([f.request.trim(), ...f.touches.map((file) => `@${file}`)]);
  if (f.skill === "free") return subject;
  return joined([`/selo-flow:${seloSkillOf(f.skill)}`, subject, ...flagsOf(f).map((flag) => `— ${flag}`)]);
}

export function canOpen(f: NewSessionForm): boolean {
  if (f.mode === "simple") return f.resume?.kind === "blueprint" || f.request.trim() !== "";
  if (usesBlueprint(f)) return f.blueprintFile !== null;
  return isRequestOptional(f.skill) || f.request.trim() !== "";
}

// sessions-live FR-47: the desktop app's own link for a new Claude Code session, its prompt typed in, not sent.
export const newSessionLink = (command: string, folder: string) =>
  `claude://code/new?q=${encodeURIComponent(command)}&folder=${encodeURIComponent(folder)}`;

// sessions-live FR-45, FR-46: the blueprints a build can take.
export const buildableBlueprints = (p: ProjectOverview) => p.blueprints.filter((b) => b.state === "ready" || b.state === "building");

// The blueprint or mockup file the command names, whose checkout the session must open in.
function chosenFile(f: NewSessionForm): string | null {
  if (f.mode === "simple") return f.resume?.file ?? null;
  if (usesBlueprint(f)) return f.blueprintFile;
  return hasMockupOption(f.skill) ? f.mockupFile : null;
}

// sessions-live FR-47: the project's folder, or the worktree holding the chosen blueprint or mockup when only a
// worktree holds it (`project` BR-01), so that its file is there.
export function folderOf(project: ProjectOverview, f: NewSessionForm): string {
  const file = chosenFile(f);
  const branch = file === null ? null : (project.blueprints.find((b) => b.file === file)?.worktreeBranch ?? project.mockups.find((m) => m.file === file)?.worktreeBranch);
  return (branch && project.worktrees.find((w) => w.branch === branch)?.root) || project.root;
}

const normalized = (path: string) => path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

// sessions-live FR-43: the project whose checkout (its base one or a worktree) holds a session's folder; the deepest
// root wins, since a project may sit inside another's folder.
export function projectOfFolder(folder: string, projects: ProjectOverview[]): ProjectOverview | null {
  const f = normalized(folder);
  let best: { project: ProjectOverview; length: number } | null = null;
  for (const project of projects) {
    for (const root of [project.root, ...project.worktrees.map((w) => w.root)].map(normalized)) {
      if ((f === root || f.startsWith(`${root}/`)) && (best === null || root.length > best.length)) best = { project, length: root.length };
    }
  }
  return best?.project ?? null;
}
