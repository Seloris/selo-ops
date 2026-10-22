# Outside sessions

Pages: `sessions-live` · Domain: `session` · Components: `api`, `web`

## Spec delta
- session ~ BR-01 — « Selo Ops reads the selo ops export (one file per session, one per project folder) and never writes to it; its own data (archives, desktop links) lives apart. » → « Selo Ops reads the selo ops export (one file per session, one per project folder) and, for the sessions outside selo (BR-12), the status files and transcripts Claude Code writes; it never writes to any of them, and its own data (archives, desktop links) lives apart. »
- session ~ BR-05 — « A session's project is its repository, named after its manifest: sessions of a worktree belong to the repository's project and carry their worktree's branch. » → « A session's project is its repository, named after its manifest, else after the repository's folder: sessions of a worktree belong to the repository's project and carry their worktree's branch; a session outside selo whose folder is in no git repository has that folder as its project. »
- session + BR-12 — A session outside selo is a running Claude Code process whose session has no file in the export (a workspace without the plugin, a session the plugin never exported); it is listed only while its process runs, is never closed, and leaves the list with no history when the process ends.
- session + BR-13 — A session outside selo is « En cours » while Claude works, « Attend ta réponse » when Claude Code says it awaits an answer, and « Tour terminé » when it is idle; never « Commit à valider », « Terminé » nor « Arrêtée », which only the plugin knows.
- sessions-live ~ FR-11 — « A row shows the state, the project (unless grouped by project), the type of work (« libre », fastlane, blueprint, build, autopilot…), the cut request, what is awaited when the session is « à traiter », the age and an « Ouvrir dans Claude Code » icon button. » → « A row shows the state, the project (unless grouped by project), the type of work (« libre », « hors selo » for a session outside selo (`session` BR-12), fastlane, blueprint, build, autopilot…), the cut request, what is awaited when the session is « à traiter », the age and an « Ouvrir dans Claude Code » icon button. »
- sessions-live ~ FR-19 — « … « Peut-on fermer la session ? » with « Oui, rien ne bloque » or « Pas encore » and its blockers (`session` BR-06); … » → « The detail shows the state and tag, the request, project, branch, type and age; the whole awaited text (a commit with its body); « Peut-on fermer la session ? » with « Oui, rien ne bloque » or « Pas encore » and its blockers (`session` BR-06), or « Inconnu hors selo » with no blocker for a session outside selo; the recap and commits of a finished run; the subagents of the current run (type, task, state); the files touched; the model (« — » when unknown), effort, permissions, blueprint, folder and session id. »
- sessions-live + FR-30 — Wherever a session outside selo (`session` BR-12) shows, its effort and permissions read « — » and its recap, commits, subagents, files touched and blueprint are left out, since only the export gives them.
- sessions-live ~ FR-15 — « What is awaited is the question, the proposed commit's subject or the error; … » → « What is awaited is the question (« Claude attend ta réponse dans la session » for a session outside selo, whose question Claude Code does not give), the proposed commit's subject or the error; an « Arrêtée » session with no error shows « Interrompue, sans message d'erreur ». »
- sessions-live ~ FR-12 — « A project block's header shows its name, its branch, its count of uncommitted files, its count « à traiter » and its count of sessions. » → « A project block's header shows its name, its branch, its count of uncommitted files (none for a project only sessions outside selo show), its count « à traiter » and its count of sessions. »
- sessions-live + Non-goal: « For a session outside selo: its end-of-turn phase, commits, blockers, subagents, and any history once its process ended. »

## Business decisions
- An outside session in a repository that also has selo sessions → joins that project's block (one project per repository, `session` BR-05)
- A status value other than the known ones → « En cours », neither « à traiter » nor archivable (the process lives; nothing says it waits)
- No readable prompt in the transcript → the session's name from its status file, else « Demande non lisible dans l'export » (FR-24 unchanged)
- An idle outside session older than 30 min → « Sans nouvelles depuis X » like any session (FR-14 unchanged)

### Decided during build
- What an outside session « Attend ta réponse » shows as awaited, Claude Code giving no question text → « Claude attend ta réponse dans la session » (an empty « Question posée » says nothing; ~FR-15 added)

## Technical defaults
- Status files → every `{config dir}/sessions/*.json` whose `sessionId` has no export file and whose `pid` still runs (a crash leaves the file), read on each list request, no copy in the database
- Status mapping → `busy` (what the files say today) and `running` → `turn-running`, `awaitingAnswer` → `question`, `idle` → `turn-ended`
- Contract → `Session.isOutsideSelo` (the web keys « hors selo », « Inconnu hors selo » and FR-30 on it, never on empty blockers), `lane` `outside`; `Project.changedCount` nullable, null hiding the count of FR-12
- Transcript → `projects/{rootKey(cwd)}/{sessionId}.jsonl`, the folder matched case-insensitively (`c--` and `C--` both exist), else a scan of `projects/*/{sessionId}.jsonl`; only its last 256 KB read
- Request → the last `last-prompt` record, else the last person prompt (text, not `tool_result` nor `isMeta`); wrapper tags stripped (`session` BR-10), never marked cut (the prompt is whole)
- Model → `message.model` of the last assistant entry of the same tail
- Run identity (`session` BR-09) → the uuid of the last person prompt, else `startedAt`; archive and unarchive find outside sessions too, 404 once the process is gone
- Age → the later of `statusUpdatedAt` and the transcript's mtime (`statusUpdatedAt` moves only on a status change)
- Project → `.git` found walking up from `cwd` (a folder, or a `gitdir:` file read to its common dir), id in the export's `repo` form, branch from `HEAD`; no git process on the 5 s poll
- Desktop link (`session` BR-11) → computed live from the status file, not stored: the link table keeps the export's sessions only
- Demo → fixture status files (the API's own pid) and transcripts in the temporary export folder: one per state, one non-git folder, one worktree through a `.git` file
- Glossary at the merge → `session` meaning « One Claude Code conversation: one file of the ops export, or a running process outside selo », and a row `hors selo` / `isOutsideSelo` (the delta grammar has no glossary line)

### Decided during build
- Status mapping as written names values that exist nowhere (`awaitingAnswer` is no status of Claude Code's files, `turn-running` and `question` are no phase of the export) → Claude Code's files carry `busy`, `idle` or `waiting` with `waitingFor`: `busy`, `running` and any other status → `working`; `waiting` for a permission, sandbox, worker or goal dialog, or for no reason → `working` (it cannot be told from a tool that runs); any other `waiting` → `awaiting-answer`; `idle` → `turn-ended` (the export's own phases, so the web's states, order and buckets hold unchanged; the wait reasons as claude-companion reads the same files)
- Status file shape → its own schema (`pid`, `sessionId`, `cwd`, `startedAt` required, the rest loose), the desktop-link reader left as it was (its tests seed files with no `pid`)
- Run identity before any prompt → `started:{startedAt}` (a stable string, unlike a bare number)
- Model → an assistant entry whose model is `<synthetic>` skipped (Claude Code wrote it, no model answered)
- `changedCount` null → only for a project that sessions outside selo alone show; a project of export sessions with no project file keeps 0 (unchanged behaviour)
- Type label → keyed on `isOutsideSelo` (`LaneLabel` takes the session), neutral colour; the card's model reads « {model} · effort — » (FR-30)
- A project only outside sessions show → its header leaves out the uncommitted-files count (`changedCount` null; ~FR-12 added, the Technical default had no delta line)
- Request (review) → the last person prompt in the tail first, whole; else the last `last-prompt`, which Claude Code cuts at 200 characters and « … »: then marked cut, its « … » dropped (the « never marked cut » default assumed a whole `lastPrompt`); a command's output, a task notification, a compact summary or a line of wrapper tags only is no prompt, for the request and for the run
- Run identity when the prompt left the 256 KB tail (review) → `prompt:{lastPrompt}`, so the next long turn is not taken for the archived one; `started:{startedAt}` only with no prompt at all
- A crashed process's pid reused by another process (review, unverified) → accepted: liveness is `kill(pid, 0)` only, `procStart` not compared; such a session would stay listed until that other process ends
- Tests line « unknown → `turn-running` » → reads `working`, after the status mapping above
- Demo folders → the demo's projects live in real temporary folders (no more `~/code`), with a `.git` each, so its sessions outside selo find their repository and join a selo project

## Stages
1. api — `feat(outside-sessions): api — sessions outside selo from Claude Code's status files and transcripts`
2. web — `feat(outside-sessions): web — sessions outside selo in the list and the detail`

## Tests
- api: export session with a status file not duplicated; dead pid skipped; each status → state, unknown → `turn-running`; request from `last-prompt`, from the last prompt, from the name; tool results and meta skipped; model; transcript folder case; worktree `.git` file → main repository project and branch; non-git folder → its own project; joins a selo project; age from mtime; archive at `turn-ended` 204, else 422, process gone 404; new prompt clears the archive; desktop link not stored
- web: pure modules: « hors selo » type label, « Inconnu hors selo » closing text, null changed count hidden, outside sessions in counts, groups and filters
- browser: demo at 1280×800 and 390 wide: outside sessions in each grouping with « hors selo », their own project and a selo project's block; detail with « Inconnu hors selo » and no recap, commits, subagents, files; archive a « Tour terminé » one; Ouvrir copies `claude --resume`

## Progress
- [x] Stage 1 — api
- [x] Stage 2 — web
- [x] Review
- [x] Browser test
- [ ] Spec merged
