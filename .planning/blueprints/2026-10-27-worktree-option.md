# Worktree option

Pages: `sessions-live`, `help` · Domain: `project` · Components: `api`, `web`

## Spec delta
- sessions-live ~ FR-50 — « A mockup to build is a file of the project's `.planning/mockups/` that the export marks validated and not committed (the lane that builds a mockup commits it with its work), named by its title. » → « A mockup to build is a file of the project's `.planning/mockups/` that the export marks validated, named by its title: in the base checkout, while no commit holds it (the lane that builds it commits it with its work); in a worktree, committed on its branch or not, while the base checkout holds no file of that name (selo commits a mockup drawn in a worktree at once, and the landing brings it to the base branch). »
- help + FR-21 — Under the lane's card, a line says that `--worktree [nom]` at the end of a prompt, before `--autonomous`, runs the lane in a new worktree, or in the existing one of that name, and that the next steps' prompts then carry it, so that the work follows its worktree.
- help ~ FR-12 — « « Guide » holds FR-02 to FR-05 and FR-20, » → « « Guide » holds FR-02 to FR-05, FR-20 and FR-21, »
- help ~ FR-06 — « its options (`--iterate`, `--mockup {fichier}`, `--no-browser`, `--autonomous` on pilot only…) » → « its options (`--iterate`, `--mockup {fichier}`, `--no-browser`, `--worktree [nom]` on pilot, fastlane, blueprint, build and mockup, `--worktree {nom}` on review, try and run, `--autonomous` on pilot only…) »

## Business decisions
- How long does a worktree's committed mockup stay « to build »? → Until the base checkout holds a file of that name, i.e. its landing (as asked; a worktree whose build is done but not landed still lists it).
- Does « Nouvelle session » add `--worktree {nom}` to the prompt of a worktree's mockup or blueprint? → No (the session already opens in the worktree's folder, FR-47).
- Where does the help explain the option? → One line under the lane's card (FR-21) and the skills' options (FR-06); « Où vont les commits » is unchanged.

## Technical defaults
- Data source → the export as it is: the base checkout's mockup list tells whether the base branch holds the file; no change of the exporter nor of the API contract.

### Decided during build
- Demo data → atelier-web's worktree `one-step-checkout` holds a validated committed mockup of its own, beside the base's committed ones (the browser test needs one under « Reprendre »).
- Which tab holds help FR-21? → « Guide », under the lane's card: FR-12's list of the tab gains it, a `~ FR-12` line added to the delta (the review found FR-12 would otherwise leave FR-21 out of every tab).
- The card's `--worktree` line → static text below the result card, shown only once a lane is picked; no `laneChooser.test.ts` (nothing computed).

## Stages
1. api — `feat(worktree-option): api — a worktree's committed mockup stays to build until it lands`
2. web — `feat(worktree-option): web — the help documents --worktree`

## Tests
- api: projects routes — a worktree's validated committed mockup is listed with its branch; it is dropped once the base checkout holds a file of that name (committed); the base checkout's committed mockup is still dropped; the base's uncommitted copy still wins.
- web: `laneChooser.test.ts` when the card's line is built there; else none (static text, no component tests).
- browser: the demo, help popup — the card's `--worktree` line under a lane picked, the skills' options; « Nouvelle session » — a worktree's committed mockup under « Reprendre »; 1280 px and 375 px.

## Progress
- [x] Stage 1 — api
- [x] Stage 2 — web
- [x] Review
- [x] Browser test
- [ ] Spec merged
