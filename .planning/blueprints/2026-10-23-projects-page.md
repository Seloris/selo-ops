# Projects page

Pages: `projects` (new, `Route: /projects`) · Domain: `project` (new), `session`, `app` · Components: `api`, `web`

## Spec delta
- project + BR-01 — A project is a repository the export holds a project file of (`session` BR-05); its specs, ideas and technical debt are read from its base checkout (the folder whose repository is its own), and a blueprint only a worktree holds is added with that worktree's branch, so that work in flight in a worktree shows; a folder inside a checkout, on that checkout's branch, that the export holds a file of is a project of its own.
- project + BR-02 — A blueprint's state is the export's, shown as « Brouillon » (written, not committed), « Prêt », « En construction », « À revoir », « À fusionner », « Terminé » and « Legacy », in that order; a blueprint is open unless « Terminé » or « Legacy ».
- project + BR-03 — A blueprint's progress is its stages, each ticked or not and named by its component, then its review, then its spec merged, as the export gives them; a legacy blueprint has no progress.
- project + BR-04 — A project whose export holds no selo planning (no spec nor blueprint read, and no manifest read without error) is still listed, with its git counts only; an export error with its planning read leaves the project open, the error shown.
- session ~ BR-01 — « … and Claude Code's list of installed plugins, for the selo plugins' versions; it never writes to any of them … » → « … and Claude Code's list of installed plugins, for the selo plugins' versions, and the `.planning` files of the projects the export lists (`project` BR-01); it never writes to any of them … »
- app ~ FR-03 — « … and « Projets » and « Debug » are dimmed, marked « Bientôt » and lead nowhere until their pages exist. » → « … « Projets » opens the projects page, and « Debug » is dimmed, marked « Bientôt » and leads nowhere until its page exists. »
- projects + FR-01 — The subtitle counts the projects, their open blueprints and those « En construction » (`project` BR-02); the page refreshes itself every 5 s and shows « Mis à jour il y a X s ».
- projects + FR-02 — With no project chosen, the page shows one card per project (`project` BR-01): name, branch, uncommitted files, commits not pushed, counts of pages, domain sheets and blueprints, a bar splitting its blueprints by state, and its live sessions; projects with an open blueprint first, then by name.
- projects + FR-03 — A project with no selo planning (`project` BR-04) shows a dimmed card « Pas de planning selo » with its git counts and does not open.
- projects + FR-04 — A click on a card shows that project's view in place of the cards; the address keeps the chosen project, and « Tous les projets » goes back.
- projects + FR-05 — The project's view opens with its name, folder, branch and base branch, the selo version of its export, its uncommitted files, commits not pushed and worktrees (each with its branch and commits ahead), and the export's error when it has one.
- projects + FR-06 — Under it, tiles give each count large with its label: open blueprints out of all, pages, domain sheets, FRs, BRs, ideas and technical debts.
- projects + FR-07 — « Avancement des blueprints » shows a bar splitting the blueprints by state with a legend counting each, then one line per open blueprint: title, state, the worktree's branch when only a worktree holds it, its progress track (`project` BR-03: one pip per stage, filled once ticked, then « Revue » and « Spec fusionnée »), its live sessions and its next prompt with « Copier ».
- projects + FR-08 — « Blueprints » lists every blueprint not legacy, newest first: date, title, state, pages and domain sheets, a bar of its delta lines (added, changed, removed) and its progress track; the legacy ones sit in a folded section at the bottom with their count.
- projects + FR-09 — « Specs » lists the page specs with their route, then the domain sheets, `app` first, then « Idées » and « Dette technique »; a sheet shows a bar of its FRs and BRs scaled to the biggest sheet, its counts, its last commit (subject and age) and the open blueprints touching it.
- projects + FR-10 — A click on a blueprint, a sheet, « Idées » or « Dette technique » opens it in the side panel of `sessions-live` FR-18, with its grip bar (FR-27) and full screen (FR-37); the address keeps it, Échap or the close button closes it.
- projects + FR-11 — A blueprint's panel shows its title, state, date, pages, domain sheets and components, its progress track in large with each stage's commit subject and short hash once committed, its spec delta grouped by sheet with each line's « + », « ~ » or « - » and id, its Business decisions, its live sessions and its next prompt with « Copier », then its whole text.
- projects + FR-12 — A sheet's panel shows its title, kind, route, FR and BR counts, next free ids, last commit and the open blueprints touching it with their delta lines for this sheet, then its whole text.
- projects + FR-13 — A file's whole text is shown formatted (titles, lists, ticked boxes, tables, bold, code), read from the project when the panel opens (`project` BR-01); a file that cannot be read says so and the rest of the panel stays.
- projects + FR-14 — Each blueprint state wears one colour, the same in bars, legends, tags and tracks: hues for the open states, green for « Terminé », grey for « Legacy ».
- projects + FR-15 — An empty page or section says why: no project in the export, no blueprint, no spec, no idea, no debt.
- projects + FR-16 — When a refresh fails after a first load, the page stays as last read, under a message saying the refresh failed.
- projects + Non-goal: « Editing a file or running a selo command: the page reads, and copies prompts only. »
- projects + Non-goal: « A blueprint's mockup image and a spec's commit history. »

## Business decisions
- Form → one page `/projects`, the chosen project and the open file in the address, files in the side panel of the session detail (one spec; the person likes the session detail's look)
- Spec text → read the `.planning` files from the project's base checkout, read-only (the export holds counts and the blueprint delta, not the FR and BR texts)
- Worktrees → one project per repository, specs from its base checkout, a worktree-only blueprint added with its branch (`session` BR-05; work in flight shows)
- Visuals → state bar, progress tracks, delta bars, spec size bars, count tiles, drawn in CSS, no chart library (the usage section already draws bars that way)
- Scope → projects without selo listed dimmed; ideas and technical debt shown; mockups, editing and commit history left out

### Decided during build
- A project whose export reports an error yet read its planning (selo-ops' own export: unknown skin) → open, the error in its view; dimmed only with no spec, no blueprint and no clean manifest; `project` BR-04 reworded (read literally, « or an error » dims selo-ops itself, while FR-05 shows the error in the project's view)
- A folder inside a repository's checkout (base or worktree), on that checkout's branch, with its own export file (`samples/todo-app` in `webapp-factory`) → a project of its own, not a worktree; `project` BR-01 completed (git never checks one branch out twice; as a worktree its specs would vanish)

## Technical defaults
- Contract → `GET /v1/projects` (projects merged per repository, sheets, blueprints, idea and debt counts, live session ids per blueprint) and `GET /v1/projects/{id}/file?path=` (raw Markdown); id = the export key of the base checkout
- File guard → `path` must equal a `file` the export lists for that project, or `.planning/ideas.md` / `.planning/technical-debt.md`, resolved under its root; anything else 404
- Export schema → the new project-file fields read with `.nullish().catch(...)`, so a mismatch never drops the file sessions-live reads
- Markdown → a pure `.ts` parser of selo's subset to React elements, no `innerHTML`, no dependency
- Colours → one `--bp-*` token per state and section hues in overrides.css, both palettes; headings with icon on their hue as in the session detail
- Refresh → list polled every 5 s; a file fetched when its panel opens, not polled
- Demo → the API demo writes project files with every blueprint state, a worktree file, a project without selo, and their `.planning` files

### Decided during build
- File route's response → JSON `{ path, text }`, not `text/markdown` (the client's problem-details handling stays the same for every route)
- OpenAPI component of a project → `ProjectOverview` (`Project` is already the session's project)
- Live sessions of a project and of a blueprint → the export's live session files whose folder is one of the project's checkouts, matched on their run's blueprint, not the project file's `sessions` (written only when the project is scanned)
- Idea and debt counts → the files' top-level `- ` items
- Demo → `weather-cli` is the project without selo; `atelier-web`'s worktree `one-step-checkout` holds the worktree-only blueprint
- Open blueprints touching a sheet → computed by the API from every merged blueprint (header or delta), a worktree's own included, not the export's per-checkout list
- A blueprint two worktrees hold → the first one listed, its branch shown and its file read from it
- State colours → lime, cyan, blue, violet, fuchsia, green, grey: none is `--mark`, amber or rose; the delta's bars and signs neutral (beside a state-coloured track, a coloured delta read as a state)
- Live sessions → read from the sessions' own query (`useSessionsQuery`, one cache) and shown with their state dot and request, each a link to its detail on Sessions live (`/?session=`); the only cross-feature imports, noted in web's CLAUDE.md
- Panel width → remembered under its own key, apart from Sessions live's
- A blueprint panel's pages and domain sheets → one line (the export merges them)
- A project with no selo planning reached by its address → « Ce projet n’est plus dans l’export ops. », not its view (FR-03)

## Stages
1. api — `feat(projects-page): api — projects, their specs and blueprints read from the export`
2. web — `feat(projects-page): web — Projets page`

## Tests
- api: merge per repository (worktree-only blueprint with its branch, base copy wins); project without selo; malformed sheets or blueprints keep the file for sessions; idea and debt counts; live sessions per blueprint; file route: listed file, ideas, debt, 404 for unlisted, `../` and absolute paths
- web: pure modules: Markdown subset (titles, lists, boxes, tables, inline code and bold, raw HTML as text), state order and counts, project order, delta split, progress steps
- browser: demo, dark and light, 1920×1080, 1280×800 and 390 wide: Projets tab; cards and dimmed card; open a project, back, reload keeps it; state bar and tracks; copy a next prompt; blueprint panel with delta and whole text; sheet panel; ideas; Échap; full screen

## Progress
- [x] Stage 1 — api
- [x] Stage 2 — web
- [x] Review
- [x] Browser test
- [ ] Spec merged
