# Session

What holds for a Claude Code session on every page: its terms and its rules, as Selo Ops reads them from the selo plugin's ops export. Pages cite these `BR` ids, never restate them.

## Glossary

| Business term | Identifier | Business meaning |
|---|---|---|
| `session` | `Session` | One Claude Code conversation: one file of the ops export, or a running process outside selo. |
| `hors selo` | `isOutsideSelo` | A session outside selo: a running Claude Code process with no file in the ops export. |
| `tour` | `run` | One request of the person to a session and what the session did with it; the current run gives the session's state. |
| `état` | `state` | Where the current run stands: « Attend ta réponse », « Commit à valider », « Arrêtée », « En cours », « Tour terminé », « Terminé ». |
| `fermée` | `isClosed` | Closed in Claude Code. |
| `à traiter` | `isTodo` | Waits on the person. |
| `ce qui empêche de fermer` | `blockers` | The reasons the export gives why the session cannot be closed yet. |
| `archive` | `SessionArchive` | Selo Ops' own mark that takes a session that waits on nobody out of the list. |
| `projet` | `Project` | The repository a session works in, worktrees included. |

## Business rules

- **BR-01** — Selo Ops reads the selo ops export (one file per session, one per project folder) and, for the sessions outside selo (BR-12), the status files and transcripts Claude Code writes; it never writes to any of them, and its own data (archives, desktop links) lives apart.
- **BR-02** — A session's state is the phase of its current run: « Attend ta réponse » (question asked), « Commit à valider » (commit proposed), « Arrêtée » (error or interruption), « En cours » (Claude works), « Tour terminé » (turn ended with no question nor commit), « Terminé » (JOB DONE footer), in that order of urgency; an open session whose run ended (« Tour terminé » or « Terminé ») while a subagent of that run still works is « En cours ».
- **BR-03** — A session is closed once the export marks it ended in Claude Code; it is open otherwise.
- **BR-04** — A session is « à traiter » when it is open, not archived, and « Attend ta réponse », « Commit à valider » or « Arrêtée ».
- **BR-05** — A session's project is its repository, named after its manifest, else after the repository's folder: sessions of a worktree belong to the repository's project and carry their worktree's branch; a session outside selo whose folder is in no git repository has that folder as its project.
- **BR-06** — What keeps a session from being closed is the export's list of blockers, shown as « Travail pas terminé », « Commit en attente », « Question ouverte », « Fichiers modifiés », « Tâche de fond en cours », « Sous-agents actifs ».
- **BR-07** — A session can be archived whatever its state, closed or not; one whose current run is neither « Terminé » nor « Tour terminé » still waits on someone or works, so the person confirms first.
- **BR-08** — An archive is kept until the person unarchives the session; nothing is archived on its own.
- **BR-09** — An archive covers the run it was made on: a new run of the session brings it back to the list of open sessions.
- **BR-10** — A session's request is shown without the wrapper tags at its start (pasted content, view context) and ends with « … » when the export cut it.
- **BR-11** — A session started by the Claude desktop app opens in the app once Selo Ops has seen it running (Claude Code names the app's session only while the process runs); Selo Ops keeps that link afterwards, process ended or not. A session started elsewhere, or never seen running, has no link.
- **BR-12** — A session outside selo is a running Claude Code process whose session has no file in the export (a workspace without the plugin, a session the plugin never exported); it is listed only while its process runs, is never closed, and leaves the list with no history when the process ends.
- **BR-13** — A session outside selo is « En cours » while Claude works, « Attend ta réponse » when Claude Code says it awaits an answer, and « Tour terminé » when it is idle; never « Commit à valider », « Terminé » nor « Arrêtée », which only the plugin knows.
- **BR-14** — A session whose transcript is gone, whatever removed it (deleted from the desktop app or the terminal, or cleaned up by Claude Code after its retention period), leaves Selo Ops: it is no longer listed, never shown as outside selo, and can be neither archived nor unarchived, whatever its export file still says.
- **BR-15** — A session was created when Claude Code wrote the first dated line of its transcript; with no such line, at its oldest run the export still keeps (which may be later, the export keeping only the latest runs), or, for a session outside selo, when its process started.

Retired:
