import type { MessageKey } from "../../shared/lib/i18n/index.ts";
import type { SpecKind } from "../../shared/ui/SpecKind.tsx";

// The help page's content as translation keys, each written out in full: hand-written, static, no API call (help FR-09).

export interface Section {
  id: string;
  title: MessageKey;
}

export type LaneId = "fastlane" | "blueprint" | "pilot";

// help FR-17: the two flows beside the lanes, each in a colour of its own (help FR-11).
export type ColourId = LaneId | "mockup" | "iterate";

// help FR-12: the three tabs of the page and of the popup.
export type HelpTab = "guide" | "specs" | "technical";

export const helpTabs: { value: HelpTab; label: MessageKey }[] = [
  { value: "guide", label: "help.tabs.guide" },
  { value: "specs", label: "help.tabs.specs" },
  { value: "technical", label: "help.tabs.technical" },
];

export const sections = {
  lanes: { id: "help-lanes", title: "help.lanes.title" },
  flows: { id: "help-flows", title: "help.flows.title" },
  lifecycle: { id: "help-lifecycle", title: "help.lifecycle.title" },
  commits: { id: "help-commits", title: "help.commits.title" },
  where: { id: "help-where", title: "help.specs.where.title" },
  ids: { id: "help-ids", title: "help.specs.ids.title" },
  follows: { id: "help-follows", title: "help.specs.follows.title" },
  stubs: { id: "help-stubs", title: "help.specs.stubs.title" },
  specLine: { id: "help-spec-line", title: "help.specs.specLine.title" },
  skills: { id: "help-skills", title: "help.skills.title" },
  roles: { id: "help-roles", title: "help.roles.title" },
  settings: { id: "help-settings", title: "help.settings.title" },
} as const satisfies Record<string, Section>;

// help FR-02, FR-03: a question answered yes ends on its lane; the branch with no question is the « sinon ».
export interface Branch {
  question?: MessageKey;
  lane: LaneId;
  name: MessageKey;
  hint: MessageKey;
  prompts: MessageKey[];
}

export const decisionTree: Branch[] = [
  { question: "help.lanes.leave", lane: "pilot", name: "help.lanes.pilot.name", hint: "help.lanes.pilot.hint", prompts: ["help.lanes.pilot.prompt"] },
  {
    question: "help.lanes.newRule",
    lane: "blueprint",
    name: "help.lanes.blueprint.name",
    hint: "help.lanes.blueprint.hint",
    prompts: ["help.lanes.blueprint.prompt", "help.lanes.blueprint.promptNext"],
  },
  { lane: "fastlane", name: "help.lanes.fastlane.name", hint: "help.lanes.fastlane.hint", prompts: ["help.lanes.fastlane.prompt"] },
];

// A box of a flow: a label, a prompt, or both.
export interface FlowStep {
  label?: MessageKey;
  code?: MessageKey;
}

export interface Flow {
  lane: ColourId;
  name: MessageKey;
  steps: FlowStep[];
}

// help FR-17.
export const seeFirst: Flow[] = [
  {
    lane: "mockup",
    name: "help.flows.mockup.name",
    steps: [{ code: "help.flows.mockup.prompt" }, { label: "help.flows.mockup.loop" }, { label: "help.flows.validate" }, { label: "help.flows.mockup.build", code: "help.options.mockup" }],
  },
  {
    lane: "iterate",
    name: "help.flows.iterate.name",
    steps: [{ code: "help.flows.iterate.prompt" }, { label: "help.flows.iterate.loop" }, { label: "help.flows.validate" }, { label: "help.flows.iterate.end" }],
  },
];

// A numbered step of a band.
export interface Step {
  name: MessageKey;
  hint: MessageKey;
  code?: MessageKey;
  lanes?: LaneId[];
}

// help FR-04: the legend of the lifecycle's dots.
export const laneLegend: { id: LaneId; name: MessageKey }[] = [
  { id: "fastlane", name: "help.lanes.fastlane.name" },
  { id: "blueprint", name: "help.lanes.blueprint.short" },
  { id: "pilot", name: "help.lanes.pilot.short" },
];

// help FR-04: the steps of a piece of work, in order, with the lanes that run each one.
export const lifecycle: Step[] = [
  { name: "help.lifecycle.grill.name", hint: "help.lifecycle.grill.hint", lanes: ["blueprint", "pilot"] },
  { name: "help.lifecycle.blueprint.name", hint: "help.lifecycle.blueprint.hint", lanes: ["blueprint", "pilot"] },
  { name: "help.lifecycle.approval.name", hint: "help.lifecycle.approval.hint", lanes: ["blueprint"] },
  { name: "help.lifecycle.stages.name", hint: "help.lifecycle.stages.hint", lanes: ["fastlane", "blueprint", "pilot"] },
  { name: "help.lifecycle.review.name", hint: "help.lifecycle.review.hint", lanes: ["fastlane", "blueprint", "pilot"] },
  { name: "help.lifecycle.suites.name", hint: "help.lifecycle.suites.hint", lanes: ["fastlane", "blueprint", "pilot"] },
  { name: "help.lifecycle.browser.name", hint: "help.lifecycle.browser.hint", lanes: ["fastlane", "blueprint", "pilot"] },
  { name: "help.lifecycle.specMerged.name", hint: "help.lifecycle.specMerged.hint", lanes: ["blueprint", "pilot"] },
  { name: "help.lifecycle.footer.name", hint: "help.lifecycle.footer.hint", lanes: ["fastlane", "blueprint", "pilot"] },
];

// A short card: an optional code or kind chip on top, then one sentence.
export interface Rule {
  head?: MessageKey;
  kind?: SpecKind;
  text: MessageKey;
}

// help FR-05.
export const commitPlaces: Rule[] = [
  { head: "help.commits.baseBranch.head", text: "help.commits.baseBranch.text" },
  { head: "help.commits.worktree.head", text: "help.commits.worktree.text" },
  { head: "help.commits.push.head", text: "help.commits.push.text" },
];

export interface TreeNode {
  name: string;
  // app FR-04: the folder of a kind of spec file, and its files, wear that kind's colour and icon.
  kind?: SpecKind;
  note?: MessageKey;
  children?: TreeNode[];
}

// help FR-14: where the specs live, as a project lays them out.
export const planningTree: TreeNode = {
  name: ".planning/",
  children: [
    { name: "pages/", kind: "page", note: "help.specs.tree.pages", children: [{ name: "home.md", kind: "page", note: "help.specs.tree.home" }] },
    {
      name: "domain/",
      kind: "domain",
      note: "help.specs.tree.domain",
      children: [{ name: "todo.md", kind: "domain", note: "help.specs.tree.todo" }, { name: "app.md", kind: "domain", note: "help.specs.tree.app" }] },
    { name: "blueprints/", kind: "blueprint", note: "help.specs.tree.blueprints" },
    { name: "mockups/", note: "help.specs.tree.mockups" },
    { name: "ideas.md", note: "help.specs.tree.ideas" },
    { name: "technical-debt.md", note: "help.specs.tree.debt" },
  ],
};

// help FR-14: beside the tree, which file a fact goes to.
export const whereRules: Rule[] = [
  { kind: "page", text: "help.specs.where.page" },
  { kind: "domain", text: "help.specs.where.domain" },
  { head: "help.specs.where.citeHead", text: "help.specs.where.cite" },
];

export const idKinds: Rule[] = [
  { head: "help.specs.ids.fr.head", text: "help.specs.ids.fr.text" },
  { head: "help.specs.ids.br.head", text: "help.specs.ids.br.text" },
  { head: "help.specs.ids.us.head", text: "help.specs.ids.us.text" },
  { head: "help.specs.ids.q.head", text: "help.specs.ids.q.text" },
];

// help FR-14: how the spec follows the code, lane by lane.
export const specFlows: Flow[] = [
  {
    lane: "fastlane",
    name: "help.lanes.fastlane.name",
    steps: [{ label: "help.specs.flow.request" }, { label: "help.specs.flow.codeAndDelta" }, { label: "help.specs.flow.oneCommit", code: "help.specs.specLine.ids.head" }],
  },
  {
    lane: "blueprint",
    name: "help.lanes.blueprint.short",
    steps: [
      { label: "help.specs.flow.blueprint", code: "help.specs.flow.deltaLine" },
      { label: "help.specs.flow.stages", code: "help.specs.flow.pending" },
      { label: "help.specs.flow.merged", code: "help.specs.flow.mergedCommit" },
    ],
  },
];

export const stubSteps: Step[] = [
  { name: "help.specs.stubs.stub.name", hint: "help.specs.stubs.stub.hint", code: "help.specs.stubs.stub.code" },
  { name: "help.specs.stubs.bootstrap.name", hint: "help.specs.stubs.bootstrap.hint", code: "help.specs.stubs.bootstrap.code" },
  { name: "help.specs.stubs.delta.name", hint: "help.specs.stubs.delta.hint" },
];

// One line of a table: a code (in its lane's colour when it has one), one sentence, then its options.
export interface Row {
  head: MessageKey;
  lane?: ColourId;
  text: MessageKey;
  codes?: MessageKey[];
}

export const specLines: Row[] = [
  { head: "help.specs.specLine.ids.head", text: "help.specs.specLine.ids.text" },
  { head: "help.specs.specLine.pending.head", text: "help.specs.specLine.pending.text" },
  { head: "help.specs.specLine.none.head", text: "help.specs.specLine.none.text" },
];

// help FR-06: one row per skill; FR-11: the skill that runs a lane or a flow wears its colour (build runs the blueprint lane).
export const skills: Row[] = [
  {
    head: "help.skills.fastlane.prompt",
    lane: "fastlane",
    text: "help.skills.fastlane.what",
    codes: ["help.options.iterate", "help.options.mockup", "help.options.noBrowser"],
  },
  { head: "help.skills.blueprint.prompt", lane: "blueprint", text: "help.skills.blueprint.what", codes: ["help.options.blueprintRevise", "help.options.mockup"] },
  { head: "help.skills.build.prompt", lane: "blueprint", text: "help.skills.build.what", codes: ["help.options.stage", "help.options.noBrowser"] },
  {
    head: "help.skills.pilot.prompt",
    lane: "pilot",
    text: "help.skills.pilot.what",
    codes: ["help.options.autonomous", "help.options.mockup", "help.options.fastlane", "help.options.blueprint", "help.options.untilBlueprint", "help.options.noBrowser"],
  },
  { head: "help.skills.mockup.prompt", lane: "mockup", text: "help.skills.mockup.what", codes: ["help.options.mockupRevise"] },
  { head: "help.skills.grill.prompt", text: "help.skills.grill.what" },
  {
    head: "help.skills.review.prompt",
    text: "help.skills.review.what",
    codes: ["help.options.reviewRange", "help.options.reviewBlueprint", "help.options.reviewBlueprintBefore", "help.options.reviewPage"],
  },
  { head: "help.skills.try.prompt", text: "help.skills.try.what" },
  { head: "help.skills.run.prompt", text: "help.skills.run.what", codes: ["help.options.demo", "help.options.stop"] },
  {
    head: "help.skills.setup.prompt",
    text: "help.skills.setup.what",
    codes: ["help.options.setupComponent", "help.options.setupSkin", "help.options.setupStack", "help.options.setupSpecs", "help.options.setupUpdate"],
  },
];

// help FR-07: one row per subagent role.
export const roles: Row[] = [
  { head: "help.roles.reviewer.name", text: "help.roles.reviewer.what" },
  { head: "help.roles.runner.name", text: "help.roles.runner.what" },
  { head: "help.roles.explorer.name", text: "help.roles.explorer.what" },
  { head: "help.roles.implementer.name", text: "help.roles.implementer.what" },
];

// help FR-18: the person's selo settings.
export const settings: Row[] = [
  { head: "help.settings.routing.head", text: "help.settings.routing.text" },
  { head: "help.settings.commit.head", text: "help.settings.commit.text" },
  { head: "help.settings.models.head", text: "help.settings.models.text" },
];
