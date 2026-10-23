# Projects

Route: `/projects` · Domain: `project`, `session`, `app`

The selo projects of the developer, read from the ops export and their `.planning` files, so that the person sees at a glance where each blueprint stands and reads its specs without opening the repository.

## Header

- **FR-01** — The subtitle counts the projects, their open blueprints and those « En construction » (`project` BR-02); the page refreshes itself every 5 s and shows « Mis à jour il y a X s ».

## Projects

- **FR-02** — With no project chosen, the page shows one card per project (`project` BR-01): name, branch, uncommitted files, commits not pushed, counts of pages, domain sheets and blueprints, a bar splitting its blueprints by state, and its live sessions; projects with an open blueprint first, then by name.
- **FR-03** — A project with no selo planning (`project` BR-04) shows a dimmed card « Pas de planning selo » with its git counts and does not open.
- **FR-04** — A click on a card shows that project's view in place of the cards; the address keeps the chosen project, and « Tous les projets » goes back.

## Project's view

- **FR-05** — The project's view opens with its name, folder, branch and base branch, the selo version of its export, its uncommitted files, commits not pushed and worktrees (each with its branch and commits ahead), and the export's error when it has one.
- **FR-06** — Under it, tiles give each count large with its label: open blueprints out of all, pages, domain sheets, FRs, BRs, ideas and technical debts.
- **FR-07** — « Avancement des blueprints » shows a bar splitting the blueprints by state with a legend counting each, then one line per open blueprint: title, state, the worktree's branch when only a worktree holds it, its progress track (`project` BR-03: one pip per stage, filled once ticked, then « Revue » and « Spec fusionnée »), its live sessions and its next prompt with « Copier ».
- **FR-08** — « Blueprints » lists every blueprint not legacy, newest first: date, title, state, pages and domain sheets, a bar of its delta lines (added, changed, removed) and its progress track; the legacy ones sit in a folded section at the bottom with their count.
- **FR-09** — « Specs » lists the page specs with their route, then the domain sheets, `app` first, then « Idées » and « Dette technique »; a sheet shows a bar of its FRs and BRs scaled to the biggest sheet, its counts, its last commit (subject and age) and the open blueprints touching it.

## Side panel

- **FR-10** — A click on a blueprint, a sheet, « Idées » or « Dette technique » opens it in the side panel of `sessions-live` FR-18, with its grip bar (FR-27) and full screen (FR-37); the address keeps it, Échap or the close button closes it.
- **FR-11** — A blueprint's panel shows its title and state, then two tabs, « Résumé » open first and « Texte complet » (its whole text), so that the delta and the decisions never show twice: the summary gives its date, pages, domain sheets and components, its progress track in large with each stage's commit subject and short hash once committed, its spec delta grouped by sheet (each group with its delta bar, under a legend of the signs) with each line's « + », « ~ » or « - » and id, its Business decisions, its live sessions and its next prompt with « Copier ».
- **FR-12** — A sheet's panel shows its title and kind, then the same two tabs: the summary gives its route, FR and BR counts, next free ids, last commit and the open blueprints touching it with their delta lines for this sheet; « Texte complet » its whole text. « Idées » and « Dette technique » show their whole text alone, with no tab.
- **FR-13** — A file's whole text is shown formatted (titles, lists, ticked boxes, tables, bold, code), read from the project when the panel opens (`project` BR-01); a file that cannot be read says so and the rest of the panel stays.

## Whole page

- **FR-14** — Each blueprint state wears one colour, the same in bars, legends, tags and tracks: hues for the open states, green for « Terminé », grey for « Legacy ».
- **FR-15** — An empty page or section says why: no project in the export, no blueprint, no spec, no idea, no debt.
- **FR-16** — When a refresh fails after a first load, the page stays as last read, under a message saying the refresh failed.

## Non-goals

- Editing a file or running a selo command: the page reads, and copies prompts only.
- A blueprint's mockup image and a spec's commit history.

Retired:
