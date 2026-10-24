import type { components } from "../../../api/schema.d.ts";

export type ProjectOverview = components["schemas"]["ProjectOverview"];
export type Blueprint = components["schemas"]["Blueprint"];

// sessions-live FR-44: what the « Nouvelle session » window offers, in its groups and order.
export type SkillId = "autopilot" | "fastlane" | "mockup" | "blueprint" | "build" | "grill" | "review" | "try" | "free";
export type SkillGroup = "do" | "check" | "free";
export const SKILL_GROUPS: { group: SkillGroup; skills: SkillId[] }[] = [
  { group: "do", skills: ["autopilot", "fastlane", "mockup", "blueprint", "build"] },
  { group: "check", skills: ["grill", "review", "try"] },
  { group: "free", skills: ["free"] },
];

export type AutopilotLane = "agent" | "fastlane" | "blueprint";

export interface NewSessionForm {
  skill: SkillId;
  request: string;
  // build, and an autopilot started from a blueprint: the blueprint's file.
  blueprintFile: string | null;
  fromBlueprint: boolean;
  lane: AutopilotLane;
  untilBlueprint: boolean;
  iterate: boolean;
  noBrowser: boolean;
  // build: the one stage to run, null for all of them.
  stage: number | null;
}

export const EMPTY_FORM: NewSessionForm = {
  skill: "autopilot",
  request: "",
  blueprintFile: null,
  fromBlueprint: false,
  lane: "agent",
  untilBlueprint: false,
  iterate: false,
  noBrowser: false,
  stage: null,
};

export const usesBlueprint = (f: NewSessionForm) => f.skill === "build" || (f.skill === "autopilot" && f.fromBlueprint);
export const isRequestOptional = (skill: SkillId) => skill === "review" || skill === "try";
export const hasNoBrowser = (skill: SkillId) => skill === "autopilot" || skill === "fastlane" || skill === "build";

// sessions-live FR-45: each option a skill takes, as its selo flag.
function flagsOf(f: NewSessionForm): string[] {
  const flags: string[] = [];
  if (f.skill === "autopilot" && !f.fromBlueprint) {
    if (f.lane !== "agent") flags.push(f.lane);
    if (f.untilBlueprint && f.lane !== "fastlane") flags.push("until blueprint");
  }
  if (f.skill === "fastlane" && f.iterate) flags.push("iterate");
  if (f.skill === "build" && f.stage !== null) flags.push(`stage ${f.stage}`);
  if (hasNoBrowser(f.skill) && f.noBrowser) flags.push("no browser");
  return flags;
}

export function commandOf(f: NewSessionForm): string {
  const subject = usesBlueprint(f) ? (f.blueprintFile ?? "") : f.request.trim();
  if (f.skill === "free") return subject;
  return [`/selo:${f.skill}`, subject, ...flagsOf(f).map((flag) => `— ${flag}`)].filter((part) => part !== "").join(" ");
}

export function canOpen(f: NewSessionForm): boolean {
  if (usesBlueprint(f)) return f.blueprintFile !== null;
  return isRequestOptional(f.skill) || f.request.trim() !== "";
}

// sessions-live FR-46: the desktop app's own link for a new Claude Code session, its prompt typed in, not sent.
export const newSessionLink = (command: string, folder: string) =>
  `claude://code/new?q=${encodeURIComponent(command)}&folder=${encodeURIComponent(folder)}`;

// sessions-live FR-44: the blueprints a build can take.
export const buildableBlueprints = (p: ProjectOverview) => p.blueprints.filter((b) => b.state === "ready" || b.state === "building");

// sessions-live FR-46: the project's folder, or the worktree holding the chosen blueprint when only a worktree holds it
// (`project` BR-01), so that its file is there.
export function folderOf(project: ProjectOverview, f: NewSessionForm): string {
  const branch = usesBlueprint(f) ? project.blueprints.find((b) => b.file === f.blueprintFile)?.worktreeBranch : null;
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
