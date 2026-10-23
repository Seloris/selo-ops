# Project

What holds for a project on every page: its terms and its rules, as Selo Ops reads them from the selo ops export and the project's `.planning` files. Pages cite these `BR` ids, never restate them.

## Glossary

| Business term | Identifier | Business meaning |
|---|---|---|
| `projet` | `ProjectOverview` | A repository of the export, its worktrees merged in, with its specs and blueprints. |
| `blueprint` | `Blueprint` | A piece of work in flight, or done, written under `.planning/blueprints/`. |
| `état` | `state` | Where a blueprint stands: « Brouillon », « Prêt », « En construction », « À revoir », « À fusionner », « Terminé », « Legacy ». |
| `avancement` | `stages`, `isReviewDone`, `isSpecMerged` | A blueprint's stages, review and spec merged, each done or not. |
| `fiche` | `SpecSheet` | A page spec or a domain sheet of the project. |
| `worktree` | `worktrees` | Another checkout of the project's repository, on its own branch. |
| `slot` | `slots` | A numbered place where the app of one checkout runs, on ports of its own (base ports + 10 per slot). |

## Business rules

- **BR-01** — A project is a repository the export holds a project file of (`session` BR-05); its specs, ideas and technical debt are read from its base checkout (the folder whose repository is its own), and a blueprint only a worktree holds is added with that worktree's branch, so that work in flight in a worktree shows; a folder inside a checkout, on that checkout's branch, that the export holds a file of is a project of its own.
- **BR-02** — A blueprint's state is the export's, shown as « Brouillon » (written, not committed), « Prêt », « En construction », « À revoir », « À fusionner », « Terminé » and « Legacy », in that order; a blueprint is open unless « Terminé » or « Legacy ».
- **BR-03** — A blueprint's progress is its stages, each ticked or not and named by its component, then its review, then its spec merged, as the export gives them; a legacy blueprint has no progress.
- **BR-04** — A project whose export holds no selo planning (no spec nor blueprint read, and no manifest read without error) is still listed, with its git counts only; an export error with its planning read leaves the project open, the error shown.
- **BR-05** — A project's slots are the run files the selo plugin writes in its repository's git folder (`selo/slots/{n}.json`), read, never written, those of its own checkouts only, each with its checkout's branch, its components' names, modes and URLs; a run is « En cours » while it is not stopped, was recorded since the machine last booted and its supervisor or one of its components is still alive, else « Arrêté », so that a run left by a crash or a reboot never shows as running.
- **BR-06** — A page spec is a stub (« À bootstrapper ») when its file holds the line `Status: to bootstrap`: its page's code exists, its spec is not written yet.

Retired:
