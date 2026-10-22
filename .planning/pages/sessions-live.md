# Sessions live

Route: `/` · Domain: `session`, `app`

The home page of Selo Ops: every Claude Code session of the selo projects, live, so that the person sees at a glance which ones wait on them. It reads the ops export and acts on no session (`session` BR-01).

## Header

- **FR-01** — The subtitle counts the open sessions that are not archived, their projects and those « à traiter » (`session` BR-04), whatever the project filter and the search.
- **FR-02** — The page refreshes itself every 5 s and shows « Mis à jour il y a X s ».

## Settings bar

- **FR-03** — « Affichage » switches between Liste (one 36 px row per session) and Cartes (a grid of cards with every detail), Liste by default.
- **FR-04** — « Regrouper » offers Par projet (one block per project), Par statut (À traiter, En cours, Au repos) and Aucun (one list), Par projet by default.
- **FR-05** — « Projets » is a checklist of the projects with « Tous », each with its count of open sessions, all checked by default.
- **FR-06** — « Afficher les fermées », unchecked by default, with its count, adds a « Fermées » block of the closed sessions not archived (`session` BR-03).
- **FR-07** — The search filters on the request, the blueprint, the branch and the project, in every block.
- **FR-08** — The view and the grouping are remembered in the browser; the project filter, « Afficher les fermées » and the search are not.

## Sessions

- **FR-09** — Sessions sort by state (`session` BR-02), then the most recently updated first; by project, the project holding the most urgent session comes first.
- **FR-10** — Only sessions « à traiter » are coloured: an amber row for « Attend ta réponse » and « Commit à valider », a rose one for « Arrêtée »; « En cours » has a pulsing neutral dot, the others a grey one.
- **FR-11** — A row shows the state, the project (unless grouped by project), the type of work (« libre », « hors selo » for a session outside selo (`session` BR-12), fastlane, blueprint, build, autopilot…), the cut request, what is awaited when the session is « à traiter », the age and an « Ouvrir dans Claude Code » icon button.
- **FR-29** — The type of work has its own colour for « libre » (sky), fastlane (lime) and autopilot (violet), in the row, the card and the detail; the other types stay neutral.
- **FR-12** — A project block's header shows its name, its branch, its count of uncommitted files (none for a project only sessions outside selo show), its count « à traiter » and its count of sessions.
- **FR-13** — A card adds the whole request, what is awaited (or what the session does when nothing is), the model and effort, the permission mode, whether it can be closed, and the « Ouvrir », « Action suivante » and « Archiver » buttons.
- **FR-30** — Wherever a session outside selo (`session` BR-12) shows, its effort and permissions read « — » and its recap, commits, subagents, files touched and blueprint are left out, since only the export gives them.
- **FR-14** — The age is the time since the session's last update; after 30 min without update, whatever the state, the tag « Sans nouvelles depuis X » replaces it and the state stays; a closed row shows « Fermée · {âge} », an archived one « Archivée · {âge} ».
- **FR-15** — What is awaited is the question (« Claude attend ta réponse dans la session » for a session outside selo, whose question Claude Code does not give), the proposed commit's subject or the error; an « Arrêtée » session with no error shows « Interrompue, sans message d'erreur ».
- **FR-24** — A request of which the export holds no readable text shows « Demande non lisible dans l'export ».
- **FR-16** — An empty list says why: no project checked, no session matching the search, or no open session.
- **FR-17** — « Archivées » is a folded section at the bottom with its count; opened, it lists the archived sessions in the current view.
- **FR-25** — When a refresh fails after a first load, the list stays as last read, under a message saying the refresh failed.

## Detail

- **FR-18** — A click on a session opens its detail in a panel sliding from the right; the list stays visible with all its columns, the fixed ones narrower; the address keeps the open session, and Échap or « Fermer » closes it.
- **FR-27** — Above 900 px of width, the edge between the list and the detail drags (or moves with the arrow keys once focused) to share the width between them, the detail at least 360 px wide and the list at least 560 px; the chosen width is remembered in the browser, and a double click on the edge goes back to the default width. Below 900 px the detail covers the screen and has no edge.
- **FR-19** — The detail shows the state and tag, the request, project, branch, type and age; the whole awaited text (a commit with its body); « Peut-on fermer la session ? » with « Oui, rien ne bloque » or « Pas encore » and its blockers (`session` BR-06), or « Inconnu hors selo » with no blocker for a session outside selo; the recap and commits of a finished run; the subagents of the current run (type, task, state); the files touched; the model (« — » when unknown), effort, permissions, blueprint, folder and session id.
- **FR-28** — « Pas encore » comes with the count of blockers (« 2 choses bloquent la fermeture »), then one line per blocker, in the export's order: its label and what clears it — « Le travail n’a pas fini par JOB DONE : laisse-le aboutir ou relance-le. », « Un commit attend ton accord : valide-le ou refuse-le dans la session. », « Claude attend ta réponse dans la session. », « Des fichiers ne sont pas commités : commite-les ou annule-les. », « Une tâche de fond tourne encore : attends sa fin ou arrête-la. », « Des sous-agents travaillent encore : attends qu’ils finissent. »; the dot of a question or a commit to approve is amber, since it waits on the person, that of a background task or subagents pulses, the others are grey.

## Actions

- **FR-20** — « Ouvrir dans Claude Code » opens a session the desktop app started directly in the Claude app (`session` BR-11), with a toast reading only « Ouvert dans Claude »; any other session gets `claude --resume {id}` copied and a toast reminding to run it in the session's folder, named; when the copy is refused, the toast shows the command selected for a manual copy.
- **FR-21** — « Action suivante », shown only when the export proposes a selo command, displays it in full and copies it on « Copier »; nothing is run.
- **FR-26** — An archived session offers no « Action suivante ».
- **FR-22** — « Archiver », offered only on sessions that can be archived (`session` BR-07), moves the session to « Archivées » with a toast saying where to find it.
- **FR-23** — « Désarchiver », in an archived session's detail, puts it back in the list.

## Non-goals

- Acting on a session: the page only copies commands, opens a session in the Claude app and archives.
- Copying the transcript's path, useful only for debugging.
- A coloured chip per project: the project's name is enough.
- For a session outside selo: its end-of-turn phase, commits, blockers, subagents, and any history once its process ended.

Retired:
