# Help

Route: `/help` · Domain: `app`

A static page that explains how selo works, so that a person picks a lane and follows a piece of work at a glance, without opening the plugin.

## Tabs

- **FR-12** — The page opens on three tabs, « Guide », « Specs » and « Technique », « Guide » selected each time the page or the popup opens: « Guide » holds FR-02 to FR-05, FR-20 and FR-21, « Specs » FR-13, FR-14 and FR-19, « Technique » FR-06, FR-07 and FR-18. The tab bar stays at the top while the page or the popup scrolls; a tab chosen while the bar is stuck opens at its top.

## Choosing a lane

- **FR-02** — « Choisir sa voie » asks three questions side by side (one under the other under 640 px), none answered when the page or the popup opens, each answer a button, most with a hint of a few words: « Vous restez pendant le travail ? » (« Oui, je suis là », « Non, je pars »), « Votre demande touche… » (« Une page ou un composant », « Une nouvelle page, entité ou règle, ou plusieurs pages », « Je ne suis pas sûr, ou je ne veux pas y réfléchir ») and « Voir avant de coder ? » (« Non, directement », « Une maquette d'abord », « En itérant sur l'app qui tourne »); « Non, je pars » closes the second question (« selo choisit ») and « En itérant », which « Une nouvelle page, entité ou règle, ou plusieurs pages » and « Je ne suis pas sûr » close too, an answer it rules out being dropped, so that a person only meets the choices that exist.
- **FR-03** — Under the questions, once they are answered (the second one aside when the person leaves), a card in the lane's colour names the lane, its option (`--iterate`, `--mockup`, `--autonomous`), the answers that led to it, and its exact prompts in order, each with a « Copier » button: staying on one page or component → `/selo-flow:fastlane {demande}` (with `--iterate` when iterating); staying on a new page, entity or rule → `/selo-flow:blueprint {demande}`, then `/selo-flow:build {blueprint}`; staying unsure → `/selo-flow:pilot {demande}`, then `/selo-flow:build {blueprint}` should selo take the blueprint, its flow the pilot placing the request then the blueprint lane; leaving → `/selo-flow:pilot {demande} --autonomous`; a mockup first adds `/selo-flow:mockup {demande}` before them and `--mockup .planning/mockups/{fichier}` to the lane's prompt; a sentence says what the lane then does. Before that, a dashed box says the lane appears there; in both cases, the interactive pilot's card aside, a line gives `/selo-flow:pilot {demande}` to a person unsure of the lane: selo picks it and runs it with them.
- **FR-20** — The card's « Voir le flux », folded by default, unfolds the flow of the lane picked from the request to the JOB DONE: one row of steps joined by arrows per track (stacked, arrows down, when narrow), the mockup's or the iteration's loop first (its turns ending on « Autre chose, ou on valide ? »), then the lane's nine steps of FR-04, those it skips dashed and struck through, those waiting on the person in amber with a « vous » tag, under a legend of the three kinds of step and above one line on the worktree's landing (for the pilot, also on a simple request taking the fastlane).
- **FR-21** — Under the lane's card, a line says that `--worktree [nom]` at the end of a prompt, before `--autonomous`, runs the lane in a new worktree, or in the existing one of that name, and that the next steps' prompts then carry it, so that the work follows its worktree.

## Lifecycle

- **FR-04** — « Le parcours d'un travail » shows the nine steps of a piece of work as numbered tiles in order (Grill, Blueprint, Un oui, Étages, Revue, Suites, Navigateur, Spec fusionnée, JOB DONE), each with a hint of a few words and one dot per lane that runs it, the dots named in a legend above the tiles.
- **FR-05** — « Où vont les commits » shows three short cards: the base branch (committed as the work goes, a fastlane's commits waiting for the person's yes unless their `SELO_COMMIT` is `auto`), a worktree (commits on its branch, then one squashed commit on the base branch on the person's yes) and `git push` (never by an agent: a human pushes).

## Specs tab

- **FR-13** — The « Specs » tab explains how selo manages specs in six short sections, in this order: where each fact lives, the ids, the spec following the code, a blueprint applied, page stubs, the `Spec:` line of commit bodies.
- **FR-14** — The « Specs » tab's figures: the tree of `.planning/` with a note of a few words per entry, beside three cards saying which file a fact goes to (a page spec, a domain sheet, a page citing a BR), beneath them when narrow; the four kinds of id (FR, BR, US, Q) as small cards above one line on their numbering (per file, never renumbered nor reused, the `Retired:` line); the path from a request to the updated spec, one row of boxes per lane in its colour (fastlane, blueprint); the three steps of a stub (stub, bootstrap, the change) as numbered tiles; one row per form of the `Spec:` line.
- **FR-19** — « Un blueprint appliqué » shows a worked example, its files in the repository's language: a blueprint's Markdown with its spec delta, then the merge commit (`docs({name}): spec merged` and its `Spec:` line), then the page spec and the domain sheet it rewrites, each before and after side by side (one under the other when narrow); every line the delta adds, changes or removes is tinted green, yellow or red and signed `+`, `~` or `-`, so that a person sees what a merge writes.

## Technique tab

- **FR-06** — « Les skills » shows one row per skill (fastlane, blueprint, build, pilot, mockup, grill, review, try, run, setup): its prompt, in its lane's colour when it runs one, what it does in one sentence, and its options (`--iterate`, `--mockup {fichier}`, `--no-browser`, `--worktree [nom]` on pilot, fastlane, blueprint, build and mockup, `--worktree {nom}` on review, try and run, `--autonomous` on pilot only…).
- **FR-07** — « Les agents » shows one row per subagent role (reviewer, runner, explorer, implementer): what it does and what it never does, in one or two sentences.
- **FR-18** — « Vos réglages » shows the person's three selo settings, set in the `env` block of `~/.claude/settings.json` and read by the next new session: `SELO_ROUTING=on` (a free change request goes to `/selo-flow:pilot`; off by default), `SELO_COMMIT=auto` (a fastlane commits on the base branch without the person's yes; off by default) and `SELO_MODELS={preset}` (the agents' models, `standard` by default; `SELO_MODEL_{ROLE}`, one of the five roles named, changes one).

## Whole page

- **FR-09** — The page reads no data: it shows the same content with the API down.
- **FR-10** — « Aide » in the header of any other page opens the same content in a popup over that page, which stays as it was; Échap, « Fermer » or a click outside the popup closes it.
- **FR-16** — Above 640 px of width, an icon-only full-screen button beside « Fermer » makes the popup fill the screen (the browser goes full screen), its content kept to a readable width; the button then shows the reduce icon and gives the popup back, as does Échap (a second Échap closes it); closing the popup leaves the full screen; it is not remembered.
- **FR-11** — Each lane wears its own colour: fastlane lime, pilot violet and blueprint teal; on its answer and its result card in « Choisir sa voie », its steps in the flow, its row of the spec flow, its dot in the lifecycle and the prompts of the skills that run it (build with blueprint), so that a lane is told at a glance. The mockup (fuchsia, with the mockup skill) and the iteration (orange) wear theirs on their answers, options and tracks.

## Non-goals

- Content generated from the selo plugin's files: the page is written by hand and updated when selo changes.
- Long explanations: each fact in a few words; the plugin's files hold the detail.

Retired: FR-01, FR-08, FR-15, FR-17
