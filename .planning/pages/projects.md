# Projects

Route: `/projects` · Domain: `project`, `session`, `question`, `app`

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
- **FR-07** — « Avancement des blueprints » shows a bar splitting the blueprints by state with a legend counting each, then one line per open blueprint: title, state, the worktree's branch when only a worktree holds it, its progress track (`project` BR-03: one pip per stage, filled once ticked, numbered and named by its component, then « revue » and « fusion » in plain text), its live sessions and its next prompt with « Copier ».
- **FR-08** — « Blueprints » lists every blueprint not legacy, newest first, under a header naming its columns: date, title, state, pages and domain sheets, its delta lines added, changed and removed in figures with the zeros left out, each in its own colour (green, yellow, red), and its progress track, each stage's pip holding its number, or for a « Terminé » one a short track: one filled pip per commit holding its number, then « ✓ revu » and « ✓ fusionné »; the legacy ones sit in a folded section at the bottom with their count.
- **FR-09** — « Specs » lists the page specs with their route, then the domain sheets, `app` first, then « Idées » and « Dette technique »; a page stub wears an « À bootstrapper » tag beside its route (`project` BR-06); under a header naming the columns, a sheet shows its FR and BR counts, the count of its open questions when it has some, the age of its last commit (its subject on hover) and the open blueprints touching it.
- **FR-17** — Among its facts, « Slots » lists the project's slots by number (`project` BR-05): its number, its checkout's branch, « En cours depuis X » or « Arrêté », and each component with its mode when not `dev` and its URL, a link only while it runs; « Aucun lancement » when none.
- **FR-18** — « Journal des changements » shows the project's `.planning/changelog.md` as a vertical timeline, newest day first whatever the file's order: one node per day with its date in French (« aujourd'hui » and « hier » named) and its count of changes, then its entries in the file's order, each with its kind as a tag in its own colour (« Ajout », « Modification », « Correction », the kind written in English or in French; an entry of another kind, or with none, keeps its text under a neutral « Note »), and a « Blueprint » link that opens the blueprint in the side panel (FR-10) when the project lists it, else an inert « Blueprint » saying it is no longer in the project; under the heading, a legend counts the entries of each kind; the five newest days show first and « Voir tout l'historique » unfolds the rest; the changelog is read again with the page's refresh (FR-01); with no changelog the section says so, and a file that cannot be read says so without hiding the rest of the view.

## Side panel

- **FR-10** — A click on a blueprint, a sheet, « Idées » or « Dette technique » opens it in the side panel of `sessions-live` FR-18, with its grip bar (FR-27) and full screen (FR-37); the address keeps it, Échap or the close button closes it.
- **FR-11** — A blueprint's panel shows its title and state, then three tabs, « Résumé » open first, « Texte complet » (its whole text) and « Questions » (FR-20), so that the delta and the decisions never show twice: the summary gives its date, pages, domain sheets and components, its progress track in large with each stage's commit subject and short hash once committed, its spec delta grouped by sheet (each group with its delta bar, under a legend of the signs) with each line's « + », « ~ » or « - » and id, its Business decisions, its live sessions and its next prompt with « Copier ».
- **FR-12** — A sheet's panel shows its title and kind, with « À bootstrapper » for a page stub (`project` BR-06), then the same three tabs: the summary gives its route, FR and BR counts, next free ids, last commit and the open blueprints touching it with their delta lines for this sheet; « Texte complet » its whole text. « Idées » and « Dette technique » show their whole text alone, with no tab.
- **FR-13** — A file's whole text is shown formatted (titles, lists, ticked boxes, tables, bold, code), read from the project when the panel opens (`project` BR-01); a file that cannot be read says so and the rest of the panel stays.

## Questions

- **FR-19** — « Demander à Claude » in the project's view opens in the side panel (FR-10) the questions on the whole project: a free-text field with « Envoyer » and the project's questions on the whole project (FR-21).
- **FR-20** — The « Questions » tab of a blueprint's or a sheet's panel offers « Explique-moi vite » and « Résume », each sent at a click, a free-text field with « Envoyer », then the questions on this file (FR-21) (`question` BR-03).
- **FR-21** — Questions show newest first, each with its text or its preset's name, its age and its state (`question` BR-04): « En cours » with the time elapsed, refreshed every 2 s while one is running; « Répondu » with its answer formatted as FR-13, its model and its duration; « Échec » with its reason; « Supprimer » deletes it after a confirmation (`question` BR-06); none says « Aucune question pour l'instant ».
- **FR-22** — « Envoyer » stays disabled while the text is empty or past 2000 characters, with its count; a refused question (`question` BR-05) or a failed send keeps the text and says why under the field.

## Whole page

- **FR-14** — Each blueprint state wears one colour, the same in bars, legends, tags and tracks: hues for the open states, green for « Terminé », grey for « Legacy ».
- **FR-15** — An empty page or section says why: no project in the export, no blueprint, no spec, no idea, no debt.
- **FR-16** — When a refresh fails after a first load, the page stays as last read, under a message saying the refresh failed.

## Non-goals

- Editing a file or running a selo command: the page reads, copies prompts and asks questions (`question` BR-02) only.
- A blueprint's mockup image and a spec's commit history.

Retired:
