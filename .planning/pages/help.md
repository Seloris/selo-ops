# Help

Route: `/help` · Domain: `app`

A static page that explains how selo works, so that a person picks a lane and reads the dashboard's vocabulary without opening the plugin.

## Tabs

- **FR-12** — The page opens on three tabs, « Guide », « Specs » and « Technique », « Guide » selected each time the page or the popup opens: « Guide » holds the sections of FR-01 to FR-05, FR-08, FR-15 and FR-17, « Specs » the explanation of FR-13, « Technique » the cards of FR-06, FR-07 and FR-18. The tab bar stays at the top while the page or the popup scrolls; a tab chosen while the bar is stuck opens at its top.

## Table of contents

- **FR-01** — The « Guide » tab opens with a short table of contents linking to its four sections, in this order: choosing a lane, the lifecycle of a piece of work, the skills, specs and vocabulary.

## Choosing a lane

- **FR-02** — The "choosing a lane" section explains when to take the fastlane (one page or one component, no new entity or business rule), the blueprint then build (a new page, entity or rule, or several pages) and the pilot (selo picks the lane and runs it in the session, ` — autonomous` when the person leaves), with the prompt of each.
- **FR-17** — Under the lanes, the "choosing a lane" section explains the two flows that show a change before it is committed, one card each with when to take it, its loop and its prompts: « Maquette d'abord » (`/selo:mockup {request}`, a static HTML mockup iterated turn by turn, validated uncommitted, then taken by the fastlane or the blueprint with ` — mockup {file}`) and « Itération » (`/selo:fastlane {request} — iterate`, one change per turn on the running app with no test, review or commit, then the fastlane's end once on « on valide »); each turn of both ends on « Autre chose, ou on valide ? ».
- **FR-03** — The "choosing a lane" section holds a decision guide of yes/no questions that ends on one lane, so that a person picks a lane without reading every skill.

## Lifecycle

- **FR-04** — The "lifecycle" section shows the steps of a piece of work in order (grill, blueprint, its one yes, stages with one commit each, review, full suites, browser test, spec merged, done footer) and which lane runs which step.
- **FR-05** — The "lifecycle" section explains the two places commits go: on the base branch, committed as the work goes, a fastlane's commits on one yes of the person unless their `SELO_COMMIT` is `auto`; in a worktree, on its branch, then landed as one squashed commit on the person's yes; and that no agent ever pushes.

## Skills

- **FR-15** — The "skills" section of « Guide » lists every skill on one line: its prompt, in its lane's colour when it runs one, and what it does in one sentence; its intro points to « Technique » for the details.

## Technique tab

- **FR-06** — The « Technique » tab's "Skills" section shows one card per skill (fastlane, blueprint, build, pilot, mockup, grill, review, try, run, setup) with what it does, when to use it, its prompt and its options (`— autonomous`, `— no browser`, `— iterate`, `— mockup {file}`, `— demo`…).
- **FR-07** — The « Technique » tab's "Agents" section shows one card per subagent role (reviewer, runner, explorer, implementer) with what it does, what it never does and the manifest role it runs on (`models.reviewer`, `models.runner`…).
- **FR-18** — The « Technique » tab's "Settings" section explains the person's two selo settings, both off by default, set in the `env` block of `~/.claude/settings.json` and read by the next new session: `SELO_ROUTING=on` (a free change request goes to `/selo:pilot`) and `SELO_COMMIT=auto` (a fastlane commits on the base branch without the person's yes).

## Specs and vocabulary

- **FR-08** — The "specs and vocabulary" section defines page spec, page stub, domain sheet, FR, BR, Q, spec delta, blueprint, stage, `Spec:` line and done footer, each in one or two sentences.

## Specs tab

- **FR-13** — The « Specs » tab explains how selo manages specs in short cards rather than lists, one section each, in this order: pages and domains (where each lives, what it holds, its rule, side by side), ids (FR, BR, US, Q each on a card; per file, append-only, the `Retired:` line, a doubt as a Q), the spec following the code (the fastlane's delta in the commit of the code, the blueprint's Spec delta merged by the build, what changes no spec), page stubs and their bootstrap from the code, the `Spec:` line of commit bodies with the spec-check script.
- **FR-14** — The « Specs » tab shows these figures: the tree of `.planning/` with one note per folder and file, above its first section, beside three cards saying which file a fact goes to (beneath them when narrow); a click on a file of the tree (a page spec, a domain sheet, a blueprint, `ideas.md`, `technical-debt.md`) shows an example of its Markdown in place of the three cards, its ids highlighted, until the same file is clicked again or its close button; in the section on the spec following the code, the steps from a request to the updated spec, one row per lane in its colour (fastlane, blueprint); the three steps of a stub (stub, bootstrap, the change) as one numbered band; one card per form of the `Spec:` line and per spec-check call.

## Whole page

- **FR-09** — The page reads no data: it shows the same content with the API down.
- **FR-10** — « Aide » in the header of any other page opens the same content in a popup over that page, which stays as it was; Échap, « Fermer » or a click outside the popup closes it.
- **FR-16** — Above 640 px of width, an icon-only full-screen button beside « Fermer » makes the popup fill the screen (the browser goes full screen), its content kept to a readable width; the button then shows the reduce icon and gives the popup back, as does Échap (a second Échap closes it); closing the popup leaves the full screen; it is not remembered.
- **FR-11** — Each lane wears its own colour: fastlane lime, pilot violet and blueprint teal; on its lane card, its name in the decision guide, its tags in the lifecycle and the cards of the skills that run it (build with blueprint), so that a lane is told at a glance. The two flows (FR-17) wear theirs on their cards, mockup fuchsia (with the mockup skill) and iterate orange.

## Non-goals

- Content generated from the selo plugin's files: the page is written by hand and updated when selo changes.

Retired:
