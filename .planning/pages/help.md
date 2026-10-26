# Help

Route: `/help` · Domain: `app`

A static page that explains how selo works, so that a person picks a lane and follows a piece of work at a glance, without opening the plugin.

## Tabs

- **FR-12** — The page opens on three tabs, « Guide », « Specs » and « Technique », « Guide » selected each time the page or the popup opens: « Guide » holds FR-02 to FR-05 and FR-17, « Specs » FR-13, FR-14 and FR-19, « Technique » FR-06, FR-07 and FR-18. The tab bar stays at the top while the page or the popup scrolls; a tab chosen while the bar is stuck opens at its top.

## Choosing a lane

- **FR-02** — « Choisir sa voie » shows the three lanes, each in a box with its name, what it is for in one short sentence and its prompts: « Pilot autonome » (`/selo:pilot {demande} — autonomous`), « Blueprint puis build » (`/selo:blueprint {demande}`, then `/selo:build {blueprint}`) and « Fastlane » (`/selo:fastlane {demande}`); a line under them gives `/selo:pilot {demande}` to a person unsure of the lane: selo picks it and runs it with them.
- **FR-03** — The three lanes read as a yes/no decision tree: « Vous partez et laissez l'agent finir ? » yes → Pilot autonome; no → « Nouvelle page, entité ou règle métier, ou plusieurs pages ? » yes → Blueprint puis build; « Sinon » → Fastlane; under 640 px of width each question stacks above its lane, so that a person picks a lane at a glance.
- **FR-17** — Under the lanes, « Voir avant de committer » shows the two flows that show a change before it is committed, each as one row of boxes joined by arrows (one under the other under 640 px): « Maquette d'abord » (`/selo:mockup {demande}`, a HTML mockup touched up turn by turn, « on valide », then a lane builds it with `— mockup {fichier}`) and « Itération » (`/selo:fastlane {demande} — iterate`, one change per turn on the running app with no test or commit, « on valide », then the tests, the review and the commits once); its intro says each turn ends on « Autre chose, ou on valide ? ».

## Lifecycle

- **FR-04** — « Le parcours d'un travail » shows the nine steps of a piece of work as numbered tiles in order (Grill, Blueprint, Un oui, Étages, Revue, Suites, Navigateur, Spec fusionnée, JOB DONE), each with a hint of a few words and one dot per lane that runs it, the dots named in a legend above the tiles.
- **FR-05** — « Où vont les commits » shows three short cards: the base branch (committed as the work goes, a fastlane's commits waiting for the person's yes unless their `SELO_COMMIT` is `auto`), a worktree (commits on its branch, then one squashed commit on the base branch on the person's yes) and `git push` (never by an agent: a human pushes).

## Specs tab

- **FR-13** — The « Specs » tab explains how selo manages specs in six short sections, in this order: where each fact lives, the ids, the spec following the code, a blueprint applied, page stubs, the `Spec:` line of commit bodies.
- **FR-14** — The « Specs » tab's figures: the tree of `.planning/` with a note of a few words per entry, beside three cards saying which file a fact goes to (a page spec, a domain sheet, a page citing a BR), beneath them when narrow; the four kinds of id (FR, BR, US, Q) as small cards above one line on their numbering (per file, never renumbered nor reused, the `Retired:` line); the path from a request to the updated spec, one row of boxes per lane in its colour (fastlane, blueprint); the three steps of a stub (stub, bootstrap, the change) as numbered tiles; one row per form of the `Spec:` line.
- **FR-19** — « Un blueprint appliqué » shows a worked example, its files in the repository's language: a blueprint's Markdown with its spec delta, then the merge commit (`docs({name}): spec merged` and its `Spec:` line), then the page spec and the domain sheet it rewrites, each before and after side by side (one under the other when narrow); every line the delta adds, changes or removes is tinted green, yellow or red and signed `+`, `~` or `-`, so that a person sees what a merge writes.

## Technique tab

- **FR-06** — « Les skills » shows one row per skill (fastlane, blueprint, build, pilot, mockup, grill, review, try, run, setup): its prompt, in its lane's colour when it runs one, what it does in one sentence, and its options (`— iterate`, `— mockup {fichier}`, `— no browser`, `— autonomous` on pilot only…).
- **FR-07** — « Les agents » shows one row per subagent role (reviewer, runner, explorer, implementer): what it does and what it never does, in one or two sentences.
- **FR-18** — « Vos réglages » shows the person's three selo settings, set in the `env` block of `~/.claude/settings.json` and read by the next new session: `SELO_ROUTING=on` (a free change request goes to `/selo:pilot`; off by default), `SELO_COMMIT=auto` (a fastlane commits on the base branch without the person's yes; off by default) and `SELO_MODELS={preset}` (the agents' models, `standard` by default; `SELO_MODEL_{ROLE}`, one of the five roles named, changes one).

## Whole page

- **FR-09** — The page reads no data: it shows the same content with the API down.
- **FR-10** — « Aide » in the header of any other page opens the same content in a popup over that page, which stays as it was; Échap, « Fermer » or a click outside the popup closes it.
- **FR-16** — Above 640 px of width, an icon-only full-screen button beside « Fermer » makes the popup fill the screen (the browser goes full screen), its content kept to a readable width; the button then shows the reduce icon and gives the popup back, as does Échap (a second Échap closes it); closing the popup leaves the full screen; it is not remembered.
- **FR-11** — Each lane wears its own colour: fastlane lime, pilot violet and blueprint teal; on its box in the decision tree, its row of the spec flow, its dot in the lifecycle and the prompts of the skills that run it (build with blueprint), so that a lane is told at a glance. The two flows (FR-17) wear theirs on their rows, mockup fuchsia (with the mockup skill) and iterate orange.

## Non-goals

- Content generated from the selo plugin's files: the page is written by hand and updated when selo changes.
- Long explanations: each fact in a few words; the plugin's files hold the detail.

Retired: FR-01, FR-08, FR-15
