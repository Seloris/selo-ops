# Permission wait

Pages: `sessions-live` · Domain: `session` · Components: `api`, `web`

## Spec delta
- session ~ BR-01 — « Selo Ops reads the selo ops export (one file per session, one per project folder) and, for the sessions outside selo (BR-12), the status files and transcripts Claude Code writes; … » → « Selo Ops reads the selo ops export (one file per session, one per project folder) and the status files and transcripts Claude Code writes, for the sessions outside selo (BR-12) and for a permission wait (BR-16); it never writes to any of them, and its own data (archives, desktop links) lives apart. »
- session ~ BR-02 — « A session's state is the phase of its current run: « Attend ta réponse » (question asked), « Commit à valider » … in that order of urgency; … » → « A session's state is the phase of its current run, unless it waits on a permission (BR-16): « Attend ta réponse » (question asked), « Attend ta permission » (BR-16), « Commit à valider » (commit proposed), « Arrêtée » (error or interruption), « En cours » (Claude works), « Tour terminé » (turn ended with no question nor commit), « Terminé » (JOB DONE footer), in that order of urgency; an open session whose run ended (« Tour terminé » or « Terminé ») while a subagent of that run still works is « En cours ». »
- session + BR-16 — An open session, selo or outside selo, whose running process Claude Code says has waited on a permission dialog for at least 15 s is « Attend ta permission », whatever its run's phase, until that wait ends; a shorter wait (auto mode's checks) leaves its state as it was.
- session ~ BR-04 — « … not archived, and « Attend ta réponse », « Commit à valider » or « Arrêtée ». » → « A session is « à traiter » when it is open, not archived, and « Attend ta réponse », « Attend ta permission », « Commit à valider » or « Arrêtée ». »
- session ~ BR-13 — « A session outside selo is « En cours » while Claude works, « Attend ta réponse » when Claude Code says it awaits an answer, and « Tour terminé » when it is idle; … » → « A session outside selo is « En cours » while Claude works, « Attend ta réponse » when Claude Code says it awaits an answer, « Attend ta permission » on a permission wait (BR-16), and « Tour terminé » when it is idle; never « Commit à valider », « Terminé » nor « Arrêtée », which only the plugin knows. »
- sessions-live ~ FR-10 — « … an amber row for « Attend ta réponse » and « Commit à valider », … » → « Only sessions « à traiter » are coloured: an amber row for « Attend ta réponse », « Attend ta permission » and « Commit à valider », a rose one for « Arrêtée »; « En cours » has a pulsing neutral dot, the others a grey one. »
- sessions-live ~ FR-15 — « What is awaited is the question (« Claude attend ta réponse dans la session » for a session outside selo, whose question Claude Code does not give), the proposed commit's subject or the error; … » → « What is awaited is the question (« Claude attend ta réponse dans la session » for a session outside selo, whose question Claude Code does not give), the tool to allow (« Autoriser : {commande} » for a shell command, else « Autoriser : {outil} », « Claude attend ta permission dans la session » when the transcript names none), the proposed commit's subject or the error; an « Arrêtée » session with no error shows « Interrompue, sans message d'erreur ». »

## Business decisions
- Which waits are a permission → « permission prompt » and « sandbox request » (both a dialog the person must allow); « worker request », « goal proposal » and a wait with no reason stay « En cours » (nothing says the person is asked)
- A long permission wait → « Sans nouvelles depuis X » after 30 min like any session, the state held (FR-14 unchanged: the export does not move during a dialog)
- The tool of a subagent (Agent or Task call still open) → not named: « Claude attend ta permission dans la session » (the subagent's own call is not in the main transcript)

## Technical defaults
- Contract → a new state `awaiting-permission` in the Session state contract (not in the export's phases), and a nullable `permissionTool` field (the command, else the tool name); `question` untouched; OpenAPI handoff regenerated
- Status files → one read per list request, by `sessionId`, live pid only (`kill(pid, 0)`), never for a closed session; the latest file wins, as for outside sessions
- Wait age → `now - statusUpdatedAt ≥ 15 s` against the service's injected clock, not `Date.now`
- Tool → the transcript's last 256 KB, read only once the 15 s hold; the last assistant `tool_use` with no `tool_result` of its id after it; `Bash` and `mcp__terminal__run_in_terminal` give `input.command`, any other tool its name; Agent or Task → none
- Export session's transcript → its `rootKey` folder, else the outside sessions' case-insensitive lookup
- Web → `STATE_ORDER` and buckets take the new state (todo, right after `awaiting-answer`); a fourth awaited kind, label « Permission demandée », key « Permission »
- Demo → one export session in phase `working` (fastlane) with a status file (the demo's pid, `waiting` on « permission prompt », 4 min old) and a transcript holding an answered tool then an open `run_in_terminal`; the outside « input needed » one stays the question case
- Glossary at the merge → `état` lists « Attend ta permission » after « Attend ta réponse » (the delta grammar has no glossary line)

### Decided during build
- Status file with no `statusUpdatedAt` → the wait is dated by its last update (`updatedAt`, else `startedAt`) (a missing date must not hide a long dialog)
- One read of the status files per list → the outside sessions' reader also returns the export's open sessions' waits, the 15 s rule beside BR-13's `stateOf` (the folder is read once, as the defaults ask)
- Subagent lines (`isSidechain`) of the main transcript → skipped when looking for the open call (their calls are not the main thread's)
- A shell call with an empty command → the tool's name (nothing else to show)
- Demo session → `harbor-mobile`, fastlane, started by the desktop app, waiting 4 min on a `run_in_terminal` command (a project that had no waiting session)

## Stages
1. api — `feat(permission-wait): api — sessions waiting on a permission dialog`
2. web — `feat(permission-wait): web — « Attend ta permission » state and the tool to allow`

## Tests
- api: wait under 15 s → phase kept, at 15 s → `awaiting-permission`; export phase overridden; dead pid, closed session, `idle` or `busy` not overridden; each `waitingFor` value; outside session at 15 s; tool: Bash command, run_in_terminal command, other tool's name, all answered → null, open Agent → null; demo session listed with its tool
- web: pure modules: order right after « Attend ta réponse », todo bucket and counts, amber tone, awaited « Autoriser : … » and the fallback text
- browser: demo at 1280×800 and 390 wide: the permission row amber in À traiter with « Autoriser : … », its card and detail with the whole command

## Progress
- [x] Stage 1 — api
- [ ] Stage 2 — web
- [ ] Review
- [ ] Browser test
- [ ] Spec merged
