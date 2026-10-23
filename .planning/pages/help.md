# Help

Route: `/help` · Domain: `app`

A static page that explains how selo works, so that a person picks a lane and reads the dashboard's vocabulary without opening the plugin.

## Tabs

- **FR-12** — The page opens on two tabs, « Guide » and « Specs », « Guide » selected each time the page or the popup opens: « Guide » holds the sections of FR-01 to FR-08, « Specs » the explanation of FR-13.

## Table of contents

- **FR-01** — The « Guide » tab opens with a short table of contents linking to its four sections, in this order: choosing a lane, the lifecycle of a piece of work, skills and agents, specs and vocabulary.

## Choosing a lane

- **FR-02** — The "choosing a lane" section explains when to take the fastlane (one page or one component, no new entity or business rule), the blueprint then build (a new page, entity or rule, or several pages) and the autopilot (the person leaves), with the prompt of each.
- **FR-03** — The "choosing a lane" section holds a decision guide of yes/no questions that ends on one lane, so that a person picks a lane without reading every skill.

## Lifecycle

- **FR-04** — The "lifecycle" section shows the steps of a piece of work in order (grill, blueprint, its one yes, stages with one commit each, review, full suites, browser test, spec merged, done footer) and which lane runs which step.
- **FR-05** — The "lifecycle" section explains the two places commits go: on the base branch, committed as the work goes; in a worktree, on its branch, then landed as one squashed commit on the person's yes; and that no agent ever pushes.

## Skills and agents

- **FR-06** — The "skills and agents" section shows one card per skill (fastlane, blueprint, build, autopilot, grill, review, try, run, setup) with what it does, when to use it, its prompt and its options (`— autonomous`, `— no browser`, `— demo`…).
- **FR-07** — The "skills and agents" section shows one card per subagent role (reviewer, runner, explorer, implementer) with what it does, what it never does and the manifest role it runs on (`models.reviewer`, `models.runner`…).

## Specs and vocabulary

- **FR-08** — The "specs and vocabulary" section defines page spec, page stub, domain sheet, FR, BR, Q, spec delta, blueprint, stage, `Spec:` line and done footer, each in one or two sentences.

## Specs tab

- **FR-13** — The « Specs » tab explains how selo manages specs, one section each, in this order: page specs (one per route under `.planning/pages`, FRs grouped by zone), domain sheets (`.planning/domain`, glossary, BRs, the `app` sheet for the shell, which file gets a rule), ids (FR, BR, US, Q per file, append-only, the `Retired:` line, a doubt as a Q), page stubs and their bootstrap from the code, the spec following the code (the fastlane's delta in the commit of the code, the blueprint's Spec delta merged by the build), the `Spec:` line of commit bodies and the spec-check script.
- **FR-14** — The « Specs » tab shows three figures: the tree of `.planning/` with one note per folder and file, above its first section; a sample page spec with its ids highlighted, in the page specs section; and, in the section on the spec following the code, the steps from a request to the updated spec, one row per lane in its colour (fastlane, blueprint).

## Whole page

- **FR-09** — The page reads no data: it shows the same content with the API down.
- **FR-10** — « Aide » in the header of any other page opens the same content in a popup over that page, which stays as it was; Échap, « Fermer » or a click outside the popup closes it.
- **FR-11** — Each lane wears its own colour: fastlane lime and autopilot violet (the colours of `sessions-live` FR-29), blueprint teal; on its lane card, its name in the decision guide, its tags in the lifecycle and the cards of the skills that run it (build with blueprint), so that a lane is told at a glance.

## Non-goals

- Content generated from the selo plugin's files: the page is written by hand and updated when selo changes.

Retired:
