# Session

What holds for a Claude Code session on every page: its terms and its rules, as Selo Ops reads them from the selo plugin's ops export. Pages cite these `BR` ids, never restate them.

## Glossary

| Business term | Identifier | Business meaning |
|---|---|---|
| `session` | `Session` | One Claude Code conversation in a selo project, one file of the ops export. |
| `tour` | `run` | One request of the person to a session and what the session did with it; the current run gives the session's state. |
| `état` | `state` | Where the current run stands: « Attend ta réponse », « Commit à valider », « Arrêtée », « En cours », « Tour terminé », « Terminé ». |
| `fermée` | `isClosed` | Closed in Claude Code. |
| `à traiter` | `isTodo` | Waits on the person. |
| `ce qui empêche de fermer` | `blockers` | The reasons the export gives why the session cannot be closed yet. |
| `archive` | `SessionArchive` | Selo Ops' own mark that takes a finished session out of the list. |
| `projet` | `Project` | The repository a session works in, worktrees included. |

## Business rules

- **BR-01** — Selo Ops reads the selo ops export (one file per session, one per project folder) and never writes to it; its own data (archives) lives apart.
- **BR-02** — A session's state is the phase of its current run: « Attend ta réponse » (question asked), « Commit à valider » (commit proposed), « Arrêtée » (error or interruption), « En cours » (Claude works), « Tour terminé » (turn ended with no question nor commit), « Terminé » (JOB DONE footer), in that order of urgency.
- **BR-03** — A session is closed once the export marks it ended in Claude Code; it is open otherwise.
- **BR-04** — A session is « à traiter » when it is open, not archived, and « Attend ta réponse », « Commit à valider » or « Arrêtée ».
- **BR-05** — A session's project is its repository, named after its manifest: sessions of a worktree belong to the repository's project and carry their worktree's branch.
- **BR-06** — What keeps a session from being closed is the export's list of blockers, shown as « Travail pas terminé », « Commit en attente », « Question ouverte », « Fichiers modifiés », « Tâche de fond en cours », « Sous-agents actifs ».
- **BR-07** — Only a session whose current run is « Terminé » can be archived, closed or not; the API refuses any other.
- **BR-08** — An archive is kept until the person unarchives the session; nothing is archived on its own.
- **BR-09** — An archive covers the run it was made on: a new run of the session brings it back to the list of open sessions.
- **BR-10** — A session's request is shown without the wrapper tags at its start (pasted content, view context) and ends with « … » when the export cut it.

Retired:
