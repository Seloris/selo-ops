# Sessions live

Pages: `sessions-live` (new, `Route: /`) · Domain: `session` (new), `app` (new) · Components: `api`, `web`

## Spec delta
- session + BR-01 — Selo Ops reads the selo ops export (one file per session, one per project folder) and never writes to it; its own data (archives) lives apart.
- session + BR-02 — A session's state is the phase of its current run: « Attend ta réponse » (question asked), « Commit à valider » (commit proposed), « Arrêtée » (error or interruption), « En cours » (Claude works), « Tour terminé » (turn ended with no question nor commit), « Terminé » (JOB DONE footer), in that order of urgency.
- session + BR-03 — A session is closed once the export marks it ended in Claude Code; it is open otherwise.
- session + BR-04 — A session is « à traiter » when it is open, not archived, and « Attend ta réponse », « Commit à valider » or « Arrêtée ».
- session + BR-05 — A session's project is its repository, named after its manifest: sessions of a worktree belong to the repository's project and carry their worktree's branch.
- session + BR-06 — What keeps a session from being closed is the export's list of blockers, shown as « Travail pas terminé », « Commit en attente », « Question ouverte », « Fichiers modifiés », « Tâche de fond en cours », « Sous-agents actifs ».
- session + BR-07 — Only a session whose current run is « Terminé » can be archived, closed or not; the API refuses any other.
- session + BR-08 — An archive is kept until the person unarchives the session; nothing is archived on its own.
- session + BR-09 — An archive covers the run it was made on: a new run of the session brings it back to the list of open sessions.
- session + BR-10 — A session's request is shown without the wrapper tags at its start (pasted content, view context) and ends with « … » when the export cut it.
- app + FR-01 — The home address (`/`) opens « Sessions live », with no path to add.
- app + FR-02 — The header offers a Clair / Sombre theme switch, Sombre by default, remembered in the browser.
- sessions-live + FR-01 — The subtitle counts the open sessions that are not archived, their projects and those « à traiter » (`session` BR-04), whatever the project filter and the search.
- sessions-live + FR-02 — The page refreshes itself every 5 s and shows « Mis à jour il y a X s ».
- sessions-live + FR-03 — « Affichage » switches between Liste (one 36 px row per session) and Cartes (a grid of cards with every detail), Liste by default.
- sessions-live + FR-04 — « Regrouper » offers Par projet (one block per project), Par statut (À traiter, En cours, Au repos) and Aucun (one list), Par projet by default.
- sessions-live + FR-05 — « Projets » is a checklist of the projects with « Tous », each with its count of open sessions, all checked by default.
- sessions-live + FR-06 — « Afficher les fermées », unchecked by default, with its count, adds a « Fermées » block of the closed sessions not archived (`session` BR-03).
- sessions-live + FR-07 — The search filters on the request, the blueprint, the branch and the project, in every block.
- sessions-live + FR-08 — The view and the grouping are remembered in the browser; the project filter, « Afficher les fermées » and the search are not.
- sessions-live + FR-09 — Sessions sort by state (`session` BR-02), then the most recently updated first; by project, the project holding the most urgent session comes first.
- sessions-live + FR-10 — Only sessions « à traiter » are coloured: an amber row for « Attend ta réponse » and « Commit à valider », a rose one for « Arrêtée »; « En cours » has a pulsing neutral dot, the others a grey one.
- sessions-live + FR-11 — A row shows the state, the project (unless grouped by project), the type of work (« libre », fastlane, blueprint, build, autopilot…), the cut request, what is awaited when the session is « à traiter », the age and an « Ouvrir dans Claude Code » icon button.
- sessions-live + FR-12 — A project block's header shows its name, its branch, its count of uncommitted files, its count « à traiter » and its count of sessions.
- sessions-live + FR-13 — A card adds the whole request, what is awaited (or what the session does when nothing is), the model and effort, the permission mode, whether it can be closed, and the « Ouvrir », « Action suivante » and « Archiver » buttons.
- sessions-live + FR-14 — The age is the time since the session's last update; after 30 min without update, whatever the state, the tag « Sans nouvelles depuis X » replaces it and the state stays; a closed row shows « Fermée · {âge} », an archived one « Archivée · {âge} ».
- sessions-live + FR-15 — What is awaited is the question, the proposed commit's subject or the error; an « Arrêtée » session with no error shows « Interrompue, sans message d'erreur ».
- sessions-live + FR-16 — An empty list says why: no project checked, no session matching the search, or no open session.
- sessions-live + FR-17 — « Archivées » is a folded section at the bottom with its count; opened, it lists the archived sessions in the current view.
- sessions-live + FR-18 — A click on a session opens its detail in a panel sliding from the right; the list stays visible with all its columns, the fixed ones narrower; the address keeps the open session, and Échap or « Fermer » closes it.
- sessions-live + FR-19 — The detail shows the state and tag, the request, project, branch, type and age; the whole awaited text (a commit with its body); « Peut-on fermer la session ? » with « Oui, rien ne bloque » or « Pas encore » and its blockers (`session` BR-06); the recap and commits of a finished run; the subagents of the current run (type, task, state); the files touched; the model (« — » when unknown), effort, permissions, blueprint, folder and session id.
- sessions-live + FR-20 — « Ouvrir dans Claude Code » copies `claude --resume {id}` and a toast reminds to run it in the session's folder, named; when the copy is refused, the toast shows the command selected for a manual copy.
- sessions-live + FR-21 — « Action suivante », shown only when the export proposes a selo command, displays it in full and copies it on « Copier »; nothing is run.
- sessions-live + FR-22 — « Archiver », offered only on sessions that can be archived (`session` BR-07), moves the session to « Archivées » with a toast saying where to find it.
- sessions-live + FR-23 — « Désarchiver », in an archived session's detail, puts it back in the list.
- sessions-live + FR-24 — A request of which the export holds no readable text shows « Demande non lisible dans l'export ».
- sessions-live + FR-25 — When a refresh fails after a first load, the list stays as last read, under a message saying the refresh failed.
- sessions-live + FR-26 — An archived session offers no « Action suivante ».
- sessions-live + Non-goal: « Acting on a session: the page only copies commands and archives. »
- sessions-live + Non-goal: « Copying the transcript's path, useful only for debugging. »
- sessions-live + Non-goal: « A coloured chip per project: the project's name is enough. »

## Business decisions
- Detail form → a panel sliding from the right, the list kept with every column, the session in the address, Échap or Fermer (validated on the mockup)
- Open in Claude Code → copy `claude --resume {id}` with a toast naming the folder (no reliable link opens a desktop session from a browser)
- Archive → JOB DONE only, closed or not; kept until « Désarchiver »; a new run brings the session back (grill)
- Project → the repository, worktrees grouped under it with their own branch; the stale tag also on « En cours », so a crashed session shows (grill)
- Colours → amber and rose are the only state colours (amber added to the skin, rose is its danger); mint only for the active setting, checked boxes and Ouvrir; dark theme by default (validated)

### Decided during build
- An empty request (its context block cut by the export) → « Demande non lisible dans l'export » (+FR-24; a blank cell reads as a bug)
- A failed refresh after a first load → the last list stays, with a message above it (+FR-25; the age alone hid the failure)
- « Action suivante » on an archived session → hidden, as in the mockup (+FR-26)
- What a closed or archived session waited on → shown in neutral, no amber nor rose (FR-10: only « à traiter » is coloured; the mockup tinted them)

## Technical defaults
- Export reading → the API reads the export on each request (`SELO_OPS_DIR`, else `CLAUDE_CONFIG_DIR/selo`, else `~/.claude/selo`), `*.json` only, skipping unreadable files and a `schemaVersion` other than 1; no copy in the database (a read-only source, polled every 5 s)
- Archive storage → a table keyed by session id holding the archived run id and date; archive and unarchive endpoints; BR-07 guarded in the service
- Contract → one list endpoint with every session and its derived fields (state, closed, archived, project, branch, blockers, cleaned request, current subagents) and the projects; the front filters, groups and sorts, so the counts stay global
- Ages → the session file's `writtenAt` is the last update (age, stale tag, closed age); an archived row's age is since its archive date
- Address → the page is `/`, the open session a `?session={id}` search parameter
- Theme → a `data-theme` attribute on the root; `overrides.css` restates both palettes under it and adds `--warn` / `--warn-soft` (the mockup's values), `skin.css` untouched; settings under one localStorage key
- Web logic → state order, sort, grouping, filters, counts, stale and age formatting in pure `.ts` modules with Vitest tests; web declares `test: npx vitest run`
- i18n → the web stage creates the translation layer, French only
- Demo → the API demo writes a fixture export (the mockup's sessions and projects, times relative to its clock) to a temporary folder at start, and seeds one archive
- `session` glossary → session, run (« tour »), state, blocker, archive, project

### Decided during build
- Routes → `GET /v1/sessions`, `PUT` and `DELETE /v1/sessions/{id}/archive`, both idempotent, 404 for a session not in the export (archiving twice keeps one row; unarchiving a session not archived is a no-op)
- A session file with no run yet → not listed (it holds no request, nothing to show or act on)
- A request whose leading context block the export cut before its end → an empty request (the rest of it was never exported)
- A repository with no project file → named after its main folder, no branch, 0 uncommitted files (the export may hold a session before its project scan)
- A session file without its repository → the one of its folder's project file (the plugin sets it only on SessionStart)
- An export file whose dates are not ISO dates → skipped like an unreadable one
- Theme key → `selo-ops/theme`, apart from the page's `selo-ops/sessions-live/settings` (the theme belongs to the app, not to one page)
- Demo archives → three, not one (the folded section's order needs several)
- Detail panel width → `clamp(420px, 36vw, 600px)`: 600px at 1920, narrower at 1280 so the request column stays readable
- Under 900px → the whole page scrolls, a row shows its state and age then its request, the panel covers the screen
- Front pure logic → `data/sessionView.ts` (order, groups, filters, counts) and `ui/sessionText.ts` (labels, tones, ages), Vitest beside them; i18n `t`/`tn` on `fr.json`
- Shared UI added → Segmented, IconButton, Tag, StatusDot, Dropdown, CommandBox, Drawer, Toast, Button `size="sm"`
- Open: a subagent that runs a selo skill has its type replaced by the skill's arguments in the export (plugin side); its line then shows that text as type

## Stages
1. api — `feat(sessions-live): api — sessions read from the ops export, archive`
2. web — `feat(sessions-live): web — Sessions live page`

## Tests
- api: each phase → state; ended → closed; worktree session → repository project with its own branch; blockers; request cleaned and cut mark; subagents of the current run only; null model; temp, broken and unknown-version files skipped; list route; archive 204, refused when not « Terminé », 404 unknown; unarchive; a new run clears the archive
- web: pure modules: sort order, grouping by project and status, project order, filters and search, global counts, stale at 30 min whatever the state, age format
- browser: demo, dark and light, at 1920×1080, 1280×800 and 390 wide: list by project, status and none; cards; project filter; search; show closed; archive, find in Archivées, unarchive; detail open, Échap, reload keeps it; copy resume toast; next action copy; theme and view kept after reload

## Progress
- [x] Stage 1 — api
- [x] Stage 2 — web
- [x] Review
- [x] Browser test
- [x] Spec merged
