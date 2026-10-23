import type { MessageKey } from "../../shared/lib/i18n/index.ts";
import type { SpecKind } from "../../shared/ui/SpecKind.tsx";

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

// help FR-12: the three tabs of the page and of the popup.
export type HelpTab = "guide" | "specs" | "technical";

export const helpTabs: { value: HelpTab; label: MessageKey }[] = [
  { value: "guide", label: "help.tabs.guide" },
  { value: "specs", label: "help.tabs.specs" },
  { value: "technical", label: "help.tabs.technical" },
];

// help FR-06, FR-07: the « Technique » tab's two sections.
export const technicalSections = {
  skills: { id: "technical-skills", title: "help.skills.skillsTitle" },
  roles: { id: "technical-roles", title: "help.roles.title" },
} as const satisfies Record<string, Section>;

// A short card: an optional code or kind chip on top, then one sentence.
export interface Rule {
  head?: MessageKey;
  kind?: SpecKind;
  text: MessageKey;
}

// A numbered step of a strip.
export interface StripStep {
  name: MessageKey;
  text: MessageKey;
  code?: MessageKey;
}

// The two kinds of spec file, side by side.
export interface SpecUnit {
  kind: SpecKind;
  name: MessageKey;
  facts: { label: MessageKey; text: MessageKey }[];
}

// help FR-13: the sections of the « Specs » tab, in this order.
export const specSections = {
  units: { id: "specs-units", title: "help.specs.units.title" },
  ids: { id: "specs-ids", title: "help.specs.ids.title" },
  follows: { id: "specs-follows", title: "help.specs.follows.title" },
  stubs: { id: "specs-stubs", title: "help.specs.stubs.title" },
  specLine: { id: "specs-specLine", title: "help.specs.specLine.title" },
} as const satisfies Record<string, Section>;

// help FR-14: beside the tree, which file a fact goes to.
export const whereRules: Rule[] = [
  { kind: "page", text: "help.specs.where.page" },
  { kind: "domain", text: "help.specs.where.domain" },
  { head: "help.specs.where.citeHead", text: "help.specs.where.cite" },
];

const unitFacts = (unit: "page" | "domain") =>
  (["where", "holds", "rule"] as const).map((fact) => ({ label: `help.specs.units.${fact}` as const, text: `help.specs.units.${unit}.${fact}` as const }));

export const specUnits: SpecUnit[] = [
  { kind: "page", name: "help.specs.units.page.name", facts: unitFacts("page") },
  { kind: "domain", name: "help.specs.units.domain.name", facts: unitFacts("domain") },
];

export const idKinds: Rule[] = (["fr", "br", "us", "q"] as const).map((id) => ({ head: `help.specs.ids.${id}.head`, text: `help.specs.ids.${id}.text` }));

export const idRules: MessageKey[] = ["help.specs.ids.perFile", "help.specs.ids.appendOnly", "help.specs.ids.doubt"];

export const stubSteps: StripStep[] = [
  { name: "help.specs.stubs.stub.name", text: "help.specs.stubs.stub.text", code: "help.specs.stubs.stub.code" },
  { name: "help.specs.stubs.bootstrap.name", text: "help.specs.stubs.bootstrap.text", code: "help.specs.stubs.example1" },
  { name: "help.specs.stubs.delta.name", text: "help.specs.stubs.delta.text" },
];

export const specLines: Rule[] = [
  { head: "help.specs.specLine.example1", text: "help.specs.specLine.ids" },
  { head: "help.specs.specLine.example2", text: "help.specs.specLine.pending" },
  { head: "help.specs.specLine.example3", text: "help.specs.specLine.none" },
];

export const specChecks: Rule[] = [
  { head: "help.specs.specCheck.example1", text: "help.specs.specCheck.cite" },
  { head: "help.specs.specCheck.example2", text: "help.specs.specCheck.merge" },
];

export interface TreeNode {
  name: string;
  // app FR-04: the folder of a kind of spec file, and its files, wear that kind's colour and icon.
  kind?: SpecKind;
  note?: MessageKey;
  // help FR-14: a file's example, shown beside the tree when the file is clicked.
  sample?: string;
  children?: TreeNode[];
}

// help FR-14: the example of each file of the tree, in the repository's language like the real files.
const homeSample = `# Home

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

const todoDetailSample = `# Todo detail

Route: \`/todos/:id\` · Domain: \`todo\`

The detail of one todo, so that a person edits or closes it.

## Header

- **FR-01** — The title shows the todo's name and its state (\`todo\` BR-02).

## Form

- **FR-02** — « Enregistrer » saves the title and the due date.
- **FR-03** — A title over 120 characters is refused (\`todo\` BR-01).

Retired:`;

const todoSample = `# Todo

What holds for a todo on every page. Pages cite these \`BR\` ids, never restate them.

## Glossary

| Business term | Identifier | Business meaning |
|---|---|---|
| \`tâche\` | \`Todo\` | Something a person has to do. |
| \`échéance\` | \`dueDate\` | The day a todo is due. |

## Business rules

- **BR-01** — A todo has a title of 1 to 120 characters.
- **BR-02** — A todo is « À faire » until it is done; a done todo never reopens.

## Lifecycle

« À faire » → « Fait »

Retired:`;

const appSample = `# App

The shell: its navigation, its sign-in, its errors.

## Functional requirements

- **FR-01** — The header shows « Tâches » and the signed-in person's name.
- **FR-02** — An address that leads nowhere shows « Page introuvable ».
- **FR-03** — A failed request shows its message in a toast.

Retired:`;

const blueprintSample = `# Due date

Pages: \`home\`, \`todo-detail\` · Components: \`api\`, \`web\`

## Spec delta
- home + FR-18 — A todo past its due date shows « En retard ».
- home ~ FR-03 — A click on a row opens its detail panel.
  Before: A click on a row opens its detail.
- todo + BR-06 — A due date has passed when it is before today.

## Business decisions
- « En retard » is computed on the server, in the person's time zone.

## Technical defaults
- A nullable \`due_date\` column on \`todos\`.

## Stages
1. api — \`feat(todo): api — due date and overdue flag\`
2. web — \`feat(home): web — overdue tag\`

## Tests
- api: a todo due yesterday is overdue, one due today is not.

## Progress
- [x] Stage 1 — api
- [ ] Stage 2 — web
- [ ] Review
- [ ] Browser test
- [ ] Spec merged`;

const ideasSample = `# Ideas

The person's ideas, not yet specified: one \`## <scope>\` section per component, feature or \`app\`, new items at the bottom.
Format: \`- {YYYY-MM-DD} — **<Short title>:** <The idea>.\`

## home

- 2026-10-20 — **Sort by due date:** Sort the list by due date, the closest first.

## app

- 2026-10-22 — **Dark theme:** A dark theme, chosen in the header.`;

const debtSample = `# Technical debt

A flat list, new items appended at the bottom.
Format: \`- **<Short title> (<scope>):** <What is wrong or missing>. See [<File>](<relative-path>).\`

- **No pagination (api):** The todo list loads every todo at once. See [todoRoutes.ts](../api/src/features/todo/todoRoutes.ts).
- **Dates as text (web):** Due dates are compared as strings, not as dates. See [dueDate.ts](../web/src/features/todo/dueDate.ts).`;

// help FR-14: where the specs live, as a project lays them out.
export const planningTree: TreeNode = {
  name: ".planning/",
  children: [
    {
      name: "pages/",
      kind: "page",
      note: "help.specs.tree.pages",
      children: [
        { name: "home.md", kind: "page", note: "help.specs.tree.home", sample: homeSample },
        { name: "todo-detail.md", kind: "page", note: "help.specs.tree.todoDetail", sample: todoDetailSample },
      ],
    },
    {
      name: "domain/",
      kind: "domain",
      note: "help.specs.tree.domain",
      children: [
        { name: "todo.md", kind: "domain", note: "help.specs.tree.todo", sample: todoSample },
        { name: "app.md", kind: "domain", note: "help.specs.tree.app", sample: appSample },
      ],
    },
    {
      name: "blueprints/",
      kind: "blueprint",
      note: "help.specs.tree.blueprints",
      children: [{ name: "2026-10-21-due-date.md", kind: "blueprint", note: "help.specs.tree.blueprint", sample: blueprintSample }],
    },
    { name: "ideas.md", note: "help.specs.tree.ideas", sample: ideasSample },
    { name: "technical-debt.md", note: "help.specs.tree.debt", sample: debtSample },
  ],
};

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
