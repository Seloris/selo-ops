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

// help FR-12: the two tabs of the page and of the popup.
export type HelpTab = "guide" | "specs";

export const helpTabs: { value: HelpTab; label: MessageKey }[] = [
  { value: "guide", label: "help.tabs.guide" },
  { value: "specs", label: "help.tabs.specs" },
];

export interface SpecTopic {
  section: Section;
  points: MessageKey[];
  examples: MessageKey[];
}

// help FR-13: how selo manages specs, in this order.
export const specTopics: SpecTopic[] = [
  {
    section: { id: "specs-pages", title: "help.specs.pages.title" },
    points: ["help.specs.pages.point1", "help.specs.pages.point2", "help.specs.pages.point3", "help.specs.pages.point4"],
    examples: ["help.specs.pages.example1"],
  },
  {
    section: { id: "specs-domain", title: "help.specs.domain.title" },
    points: ["help.specs.domain.point1", "help.specs.domain.point2", "help.specs.domain.point3", "help.specs.domain.point4"],
    examples: ["help.specs.domain.example1"],
  },
  {
    section: { id: "specs-ids", title: "help.specs.ids.title" },
    points: ["help.specs.ids.point1", "help.specs.ids.point2", "help.specs.ids.point3", "help.specs.ids.point4"],
    examples: [],
  },
  {
    section: { id: "specs-stubs", title: "help.specs.stubs.title" },
    points: ["help.specs.stubs.point1", "help.specs.stubs.point2", "help.specs.stubs.point3", "help.specs.stubs.point4"],
    examples: ["help.specs.stubs.example1"],
  },
  {
    section: { id: "specs-follows", title: "help.specs.follows.title" },
    points: ["help.specs.follows.point1", "help.specs.follows.point2", "help.specs.follows.point3", "help.specs.follows.point4", "help.specs.follows.point5"],
    examples: [],
  },
  {
    section: { id: "specs-specLine", title: "help.specs.specLine.title" },
    points: ["help.specs.specLine.point1", "help.specs.specLine.point2", "help.specs.specLine.point3"],
    examples: ["help.specs.specLine.example1", "help.specs.specLine.example2", "help.specs.specLine.example3"],
  },
  {
    section: { id: "specs-specCheck", title: "help.specs.specCheck.title" },
    points: ["help.specs.specCheck.point1", "help.specs.specCheck.point2", "help.specs.specCheck.point3", "help.specs.specCheck.point4"],
    examples: ["help.specs.specCheck.example1", "help.specs.specCheck.example2"],
  },
];

export interface TreeNode {
  name: string;
  note?: MessageKey;
  children?: TreeNode[];
}

// help FR-14: where the specs live, as a project lays them out.
export const planningTree: TreeNode = {
  name: ".planning/",
  children: [
    {
      name: "pages/",
      note: "help.specs.tree.pages",
      children: [
        { name: "home.md", note: "help.specs.tree.home" },
        { name: "todo-detail.md", note: "help.specs.tree.todoDetail" },
      ],
    },
    {
      name: "domain/",
      note: "help.specs.tree.domain",
      children: [
        { name: "todo.md", note: "help.specs.tree.todo" },
        { name: "app.md", note: "help.specs.tree.app" },
      ],
    },
    {
      name: "blueprints/",
      note: "help.specs.tree.blueprints",
      children: [{ name: "2026-10-21-due-date.md", note: "help.specs.tree.blueprint" }],
    },
    { name: "ideas.md", note: "help.specs.tree.ideas" },
    { name: "technical-debt.md", note: "help.specs.tree.debt" },
  ],
};

// help FR-14: a sample page spec, in the repository's language like the real files.
export const sampleSpec = `# Home

Route: \`/\` · Domain: \`todo\`

The list of todos, so that a person sees what is left to do.

## Filters

- **FR-01** — « À faire » shows only the open todos.

## List

- **FR-02** — Each row shows its title and its due date (\`todo\` BR-01).
- **FR-03** — A click on a row opens its detail.

## Open questions

- **Q-01** — Should a done todo stay in the list?

Retired: FR-04`;

export interface FlowStep {
  label: MessageKey;
  code?: MessageKey;
}

// help FR-14: how the spec follows the code, lane by lane.
export const specFlows: { lane: LaneId; steps: FlowStep[] }[] = [
  {
    lane: "fastlane",
    steps: [
      { label: "help.specs.flow.request" },
      { label: "help.specs.flow.codeAndDelta" },
      { label: "help.specs.flow.oneCommit", code: "help.specs.specLine.example1" },
    ],
  },
  {
    lane: "blueprint",
    steps: [
      { label: "help.specs.flow.blueprint", code: "help.specs.flow.deltaLine" },
      { label: "help.specs.flow.stages", code: "help.specs.flow.pending" },
      { label: "help.specs.flow.merge", code: "help.specs.specCheck.example2" },
      { label: "help.specs.flow.merged", code: "help.specs.flow.mergedCommit" },
    ],
  },
];
