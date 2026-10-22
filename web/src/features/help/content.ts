import type { MessageKey } from "../../shared/lib/i18n/index.ts";

// The help page's content as translation keys: hand-written, static, no API call (help FR-09).

export interface Section {
  id: string;
  title: MessageKey;
}

// help FR-01: the table of contents and the sections, in this order.
export const sections = {
  lanes: { id: "lanes", title: "help.lanes.title" },
  lifecycle: { id: "lifecycle", title: "help.lifecycle.title" },
  skills: { id: "skills", title: "help.skills.title" },
  vocabulary: { id: "vocabulary", title: "help.vocabulary.title" },
} as const satisfies Record<string, Section>;

export const sectionOrder: Section[] = [sections.lanes, sections.lifecycle, sections.skills, sections.vocabulary];

export type LaneId = "fastlane" | "blueprint" | "autopilot";

export interface Lane {
  id: LaneId;
  name: MessageKey;
  short: MessageKey;
  when: MessageKey;
  prompts: MessageKey[];
}

export const lanesById: Record<LaneId, Lane> = {
  fastlane: {
    id: "fastlane",
    name: "help.lanes.fastlane.name",
    short: "help.lanes.fastlane.short",
    when: "help.lanes.fastlane.when",
    prompts: ["help.lanes.fastlane.prompt"],
  },
  blueprint: {
    id: "blueprint",
    name: "help.lanes.blueprint.name",
    short: "help.lanes.blueprint.short",
    when: "help.lanes.blueprint.when",
    prompts: ["help.lanes.blueprint.prompt", "help.lanes.blueprint.promptNext"],
  },
  autopilot: {
    id: "autopilot",
    name: "help.lanes.autopilot.name",
    short: "help.lanes.autopilot.short",
    when: "help.lanes.autopilot.when",
    prompts: ["help.lanes.autopilot.prompt"],
  },
};

export const lanes: Lane[] = [lanesById.fastlane, lanesById.blueprint, lanesById.autopilot];

// help FR-03: each question answered yes ends on its lane; no goes to the next one, the last no ends on `otherwise`.
export interface DecisionGuide {
  questions: { question: MessageKey; yes: LaneId }[];
  otherwise: LaneId;
}

export const decisionGuide: DecisionGuide = {
  questions: [
    { question: "help.guide.leave.question", yes: "autopilot" },
    { question: "help.guide.newRule.question", yes: "blueprint" },
    { question: "help.guide.severalPages.question", yes: "blueprint" },
  ],
  otherwise: "fastlane",
};

export interface LifecycleStep {
  name: MessageKey;
  text: MessageKey;
  lanes: LaneId[];
}

// help FR-04: the steps of a piece of work, in order, with the lanes that run each one.
export const lifecycleSteps: LifecycleStep[] = [
  { name: "help.lifecycle.grill.name", text: "help.lifecycle.grill.text", lanes: ["blueprint", "autopilot"] },
  { name: "help.lifecycle.blueprint.name", text: "help.lifecycle.blueprint.text", lanes: ["blueprint", "autopilot"] },
  { name: "help.lifecycle.approval.name", text: "help.lifecycle.approval.text", lanes: ["blueprint"] },
  { name: "help.lifecycle.stages.name", text: "help.lifecycle.stages.text", lanes: ["fastlane", "blueprint", "autopilot"] },
  { name: "help.lifecycle.review.name", text: "help.lifecycle.review.text", lanes: ["fastlane", "blueprint", "autopilot"] },
  { name: "help.lifecycle.suites.name", text: "help.lifecycle.suites.text", lanes: ["fastlane", "blueprint", "autopilot"] },
  { name: "help.lifecycle.browser.name", text: "help.lifecycle.browser.text", lanes: ["fastlane", "blueprint", "autopilot"] },
  { name: "help.lifecycle.specMerged.name", text: "help.lifecycle.specMerged.text", lanes: ["blueprint", "autopilot"] },
  { name: "help.lifecycle.footer.name", text: "help.lifecycle.footer.text", lanes: ["fastlane", "blueprint", "autopilot"] },
];

// help FR-05.
export const commitPlaces: MessageKey[] = ["help.commits.baseBranch", "help.commits.worktree", "help.commits.push"];

export interface Skill {
  name: MessageKey;
  what: MessageKey;
  when: MessageKey;
  prompt: MessageKey;
  options: MessageKey[];
  // help FR-11: the skill that runs a lane wears its colour (build runs the blueprint lane).
  lane?: LaneId;
}

// help FR-06: one card per skill.
export const skills: Skill[] = [
  {
    name: "help.skills.fastlane.name",
    what: "help.skills.fastlane.what",
    when: "help.skills.fastlane.when",
    prompt: "help.skills.fastlane.prompt",
    lane: "fastlane",
    options: ["help.options.noBrowser", "help.options.autonomous"],
  },
  {
    name: "help.skills.blueprint.name",
    what: "help.skills.blueprint.what",
    when: "help.skills.blueprint.when",
    prompt: "help.skills.blueprint.prompt",
    lane: "blueprint",
    options: ["help.options.blueprintRevise", "help.options.autonomous"],
  },
  {
    name: "help.skills.build.name",
    what: "help.skills.build.what",
    when: "help.skills.build.when",
    prompt: "help.skills.build.prompt",
    lane: "blueprint",
    options: ["help.options.stage", "help.options.noBrowser", "help.options.autonomous"],
  },
  {
    name: "help.skills.autopilot.name",
    what: "help.skills.autopilot.what",
    when: "help.skills.autopilot.when",
    prompt: "help.skills.autopilot.prompt",
    lane: "autopilot",
    options: ["help.options.fastlane", "help.options.blueprint", "help.options.untilBlueprint", "help.options.noBrowser"],
  },
  {
    name: "help.skills.grill.name",
    what: "help.skills.grill.what",
    when: "help.skills.grill.when",
    prompt: "help.skills.grill.prompt",
    options: ["help.options.autonomous"],
  },
  {
    name: "help.skills.review.name",
    what: "help.skills.review.what",
    when: "help.skills.review.when",
    prompt: "help.skills.review.prompt",
    options: ["help.options.reviewRange", "help.options.reviewBlueprint", "help.options.reviewBlueprintBefore", "help.options.reviewPage"],
  },
  {
    name: "help.skills.try.name",
    what: "help.skills.try.what",
    when: "help.skills.try.when",
    prompt: "help.skills.try.prompt",
    options: [],
  },
  {
    name: "help.skills.run.name",
    what: "help.skills.run.what",
    when: "help.skills.run.when",
    prompt: "help.skills.run.prompt",
    options: ["help.options.demo", "help.options.stop"],
  },
  {
    name: "help.skills.setup.name",
    what: "help.skills.setup.what",
    when: "help.skills.setup.when",
    prompt: "help.skills.setup.prompt",
    options: [
      "help.options.setupComponent",
      "help.options.setupModels",
      "help.options.setupSkin",
      "help.options.setupStack",
      "help.options.setupSpecs",
      "help.options.setupUpdate",
    ],
  },
];

export interface Role {
  name: MessageKey;
  what: MessageKey;
  never: MessageKey;
  model: MessageKey;
}

// help FR-07: one card per subagent role.
export const roles: Role[] = (["reviewer", "runner", "explorer", "implementer"] as const).map((role) => ({
  name: `help.roles.${role}.name`,
  what: `help.roles.${role}.what`,
  never: `help.roles.${role}.never`,
  model: `help.roles.${role}.model`,
}));

export interface Term {
  term: MessageKey;
  definition: MessageKey;
}

// help FR-08.
export const vocabulary: Term[] = (
  ["pageSpec", "pageStub", "domainSheet", "fr", "br", "q", "specDelta", "blueprint", "stage", "specLine", "doneFooter"] as const
).map((term) => ({ term: `help.vocabulary.${term}.term`, definition: `help.vocabulary.${term}.definition` }));
