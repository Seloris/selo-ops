# Session

What holds for a Claude Code session on every page: its terms and its rules, as Selo Ops reads them from the selo plugin's ops export. Pages cite these `BR` ids, never restate them.

## Glossary

| Business term | Identifier | Business meaning |
|---|---|---|
| `session` | `Session` | One Claude Code conversation: one file of the ops export, or a running process outside selo. |
| `hors selo` | `isOutsideSelo` | A session outside selo: a running Claude Code process with no file in the ops export. |
| `tour` | `run` | One request of the person to a session and what the session did with it; the current run gives the session's state. |
| `état` | `state` | Where the current run stands: « Attend ta réponse », « Attend ta permission », « Commit à valider », « Arrêtée », « En cours », « Tour terminé », « Job done ». |
| `fermée` | `isClosed` | Closed in Claude Code. |
| `à traiter` | `isTodo` | Waits on the person. |
| `ce qui empêche de fermer` | `blockers` | The reasons the export gives why the session cannot be closed yet. |
| `archive` | `SessionArchive` | Selo Ops' own mark that takes a session that waits on nobody out of the list. |
| `projet` | `Project` | The repository a session works in, worktrees included. |
| `consommation` | `usage` | What a run or the whole session consumed: API calls and tokens by kind, and their split per model. |
| `tokens` | `Tokens` | The four kinds of tokens: « Entrée », « Cache lu », « Cache écrit », « Sortie ». |
| `modèle réel` | `byModel[0].model` | The model a subagent actually ran on: the top model of its own usage. |

## Business rules

- **BR-01** — Selo Ops reads the selo ops export (one file per session, one per project folder) and the status files and transcripts Claude Code writes, for the sessions outside selo (BR-12), for a permission wait (BR-16) and for a question the export missed (BR-17), and Claude Code's list of installed plugins, for the selo plugins' versions, and the `.planning` files of the projects the export lists (`project` BR-01); it never writes to any of them, and its own data (archives, notes, desktop links) lives apart. It runs git only for the files a session touched, read-only, in the session's folder, when the person asks for them, never on the 5 s refresh: the status and lines added and removed of each of them when « Fichiers modifiés » unfolds in its detail or its window opens, and the diff of one of them when it is shown, only from the commits the export recorded for the session and the file's uncommitted changes.
- **BR-02** — A session's state is the phase of its current run, unless it waits on a permission (BR-16) or on an answer the export missed (BR-17): « Attend ta réponse » (question asked), « Attend ta permission » (BR-16), « Commit à valider » (commit proposed), « Arrêtée » (error or interruption), « En cours » (Claude works), « Tour terminé » (turn ended with no question nor commit), « Job done » (JOB DONE footer), in that order of urgency; an open session whose run ended (« Tour terminé » or « Job done ») while a subagent of that run still works is « En cours ».
- **BR-03** — A session is closed once the export marks it ended in Claude Code; it is open otherwise.
- **BR-04** — A session is « à traiter » when it is open, not archived, and « Attend ta réponse », « Attend ta permission », « Commit à valider » or « Arrêtée ».
- **BR-05** — A session's project is its repository, named after its manifest, else after the repository's folder: sessions of a worktree belong to the repository's project and carry their worktree's branch; a session outside selo whose folder is in no git repository has that folder as its project.
- **BR-06** — What keeps a session from being closed is the export's list of blockers, shown as « Travail pas terminé », « Commit en attente », « Question ouverte », « Fichiers modifiés », « Tâche de fond en cours », « Sous-agents actifs ».
- **BR-07** — A session can be archived whatever its state, closed or not; one whose current run is neither « Job done » nor « Tour terminé » still waits on someone or works, so the person confirms first.
- **BR-08** — An archive is kept until the person unarchives the session; nothing is archived on its own.
- **BR-09** — An archive covers the run it was made on: a new run of the session brings it back to the list of open sessions.
- **BR-10** — A session's request is shown without the wrapper tags at its start (pasted content, view context) and ends with « … » when the export cut it. A request the export left empty because its prompt is an image with no text reads « Image seule, sans texte »; any other empty one reads « Demande non lisible dans l’export ».
- **BR-11** — A session started by the Claude desktop app opens in the app once Selo Ops has seen it running (Claude Code names the app's session only while the process runs); Selo Ops keeps that link afterwards, process ended or not. A session started elsewhere, or never seen running, has no link.
- **BR-12** — A session outside selo is a running Claude Code process whose session has no file in the export (a workspace without the plugin, a session the plugin never exported); it is listed only while its process runs, is never closed, and leaves the list with no history when the process ends; the run answering a question (`question` BR-01) is never listed.
- **BR-13** — A session outside selo is « En cours » while Claude works, « Attend ta réponse » when Claude Code says it awaits an answer, « Attend ta permission » on a permission wait (BR-16), and « Tour terminé » when it is idle; never « Commit à valider », « Job done » nor « Arrêtée », which only the plugin knows.
- **BR-14** — A session whose transcript is gone, whatever removed it (deleted from the desktop app or the terminal, or cleaned up by Claude Code after its retention period), leaves Selo Ops: it is no longer listed, never shown as outside selo, and can be neither archived nor unarchived, whatever its export file still says.
- **BR-15** — A session was created when Claude Code wrote the first dated line of its transcript; with no such line, at its oldest run the export still keeps (which may be later, the export keeping only the latest runs), or, for a session outside selo, when its process started.
- **BR-16** — An open session, selo or outside selo, whose running process Claude Code says has waited on a permission dialog for at least 15 s is « Attend ta permission », whatever its run's phase, until that wait ends; a shorter wait (auto mode's checks) leaves its state as it was.
- **BR-17** — An open selo session whose run is « En cours » while Claude Code says its running process awaits an answer (any wait but a permission dialog, a worker request or a goal proposal) is « Attend ta réponse » until that wait ends, so that a question asked through Claude Code's dialog, which the export does not record, shows at once; any other phase stays as the export gives it.
- **BR-18** — A session's and a run's usage (API calls, tokens by kind: « Entrée », « Cache lu », « Cache écrit », « Sortie », and their split per model) are read from the export only, never counted by Selo Ops; a session outside selo (BR-12), a run before its first stop, a subagent still working and a subagent stopped by Échap have none and show « — ».
- **BR-19** — A run whose figures the export has not settled yet shows them tagged « provisoire », since they may still grow; a run whose figures cover only the end of an oversized transcript shows them tagged « partiel : 32 derniers Mo ».
- **BR-20** — A session's model is the export's, else the top model of its latest main run that has usage, so that the list, the card and the detail agree; a subagent's model is the top model of its own usage (its real model).
- **BR-21** — A session holds at most one note of the person, plain text of 200 characters at most, trimmed; unlike an archive (BR-09) it is kept across the session's runs, until the person clears it, and an empty text is no note.
- **BR-22** — A session's type of work is its current run's flow (« libre », fastlane, blueprint, pilot), « pilot » reading « pilot autonome » when the run's mode is autonomous, followed by « › {skill} » while a selo skill other than the flow runs (« pilot › fastlane », « pilot autonome › build », « libre › review », « libre › mockup »), as the export gives them; a fastlane run in its iterate mode (the run's mode) reads « fastlane › itération » while its loop runs: until its end's first mark past `code` (`tests` first); a run with no flow reads « libre », and a session outside selo reads « hors selo » (BR-12).

Retired:
