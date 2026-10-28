# CLI launch

Pages: `sessions-live` · Domain: `session`, `settings`, `app` · Components: `api`, `web`

## Spec delta
- settings + BR-05 — « Lancer les sessions en CLI » is a setting of Selo Ops itself, off by default, kept in its own data and never in Claude Code's settings file (BR-01), the same for every browser that opens this Selo Ops.
- app + FR-13 — « Réglages » ends with a « Selo Ops » section holding the switch « Lancer les sessions en CLI » and « Nouvelle session démarre Claude Code en arrière-plan, Remote Control activé » (`settings` BR-05), saved with the others by « Enregistrer » (FR-11) and usable even when the settings file is unreadable (FR-12).
- session + BR-24 — Selo Ops starts a session only on « Lancer » of the launch recap (`sessions-live` FR-61) while « Lancer les sessions en CLI » is on (`settings` BR-05), and only in a project's checkout or one of its worktrees (`project` BR-01): a Claude Code session in the background, its command as its first prompt, Remote Control on and named « {projet} · {demande} », with the person's own permission settings unless « Mode auto » asks for Claude Code's auto mode; it is then read from the export like any other session.
- sessions-live + FR-60 — While « Lancer les sessions en CLI » is off (`settings` BR-05), every « Nouvelle session » button (FR-43, FR-12, FR-59) is disabled, « Active le mode CLI dans Réglages » on hover.
- sessions-live ~ FR-47 — « Its copy button copies it. « Copier et ouvrir » (also Ctrl+Entrée), … and offers « Rouvrir »; a refused copy still opens the session. » → « Its copy button copies it. « Lancer la session » (also Ctrl+Entrée), disabled until the request or the blueprint is given, opens the launch recap (FR-61). »
- sessions-live + FR-61 — The launch recap « Lancer la session ? » shows the project, the folder the session starts in (for a blueprint or a mockup only a worktree holds, that worktree's, `project` BR-01), the command in full, « En arrière-plan · Remote Control activé », and a « Mode auto » switch with `--permission-mode auto` beside it, off the first time and remembered in the browser as FR-49; « Retour » goes back to the form as it was, « Lancer » starts the session (`session` BR-24).
- sessions-live + FR-62 — A session started closes the window with the toast « Session lancée dans {projet} · suis-la ici ou dans Remote Control »; a start that fails (Claude Code not found, an error, the CLI mode turned off meanwhile) keeps the recap open with the error above « Lancer ».
- sessions-live ~ Non-goal: « Acting on a session: the page only copies commands, opens a session or a new one in the Claude app, archives, keeps a note and flags; it never sends a prompt. » → « Acting on a session: the page only copies commands, opens a session in the Claude app, starts a new one from the launch recap (FR-61), archives, keeps a note and flags; it never sends a prompt to a session already started. »

## Business decisions
- Where the CLI mode lives → a switch in « Réglages », section « Selo Ops », kept in Selo Ops' database (it is no selo setting: no `SELO_` key; one place for every browser).
- CLI mode off → the « Nouvelle session » buttons stay visible, disabled, with the hint (discoverable; the window stays out of reach).
- Window foot → the copy button stays, « Lancer la session » replaces « Copier et ouvrir » (Claude Desktop link dropped).
- Permissions → the person's own by default, a « Mode auto » switch in the recap, remembered (the person's answer: auto must be one click away).
- How it starts → in the background with Remote Control (the request: headless, `--rc`), so the person follows it here and in the Claude apps.

## Technical defaults
- The start → `claude --bg --remote-control "{projet} · {demande cut to 40}" [--permission-mode auto] "{command}"` in the folder, no shell, `CLAUDE_BIN` as the question runner uses it; awaited until `--bg` returns its id (30 s at most).
- Safety → the API refuses a launch when the CLI mode is off (409) or a folder that is no project checkout nor worktree of the export (400): it never runs a command elsewhere.
- Storage → one `app_settings` key–value table with a migration; `GET`/`PATCH /v1/settings` carry `seloOps.cliLaunch` beside the `SELO_` settings.
- Demo → a fake launcher answering success, so the demo never starts Claude Code.

## Stages
1. api — `feat(cli-launch): api — CLI mode setting and background session launch`
2. web — `feat(cli-launch): web — « Lancer la session » with its recap, buttons off without the CLI mode`

## Tests
- api: the setting off by default, saved and read back; the launch arguments (with and without « Mode auto », the Remote Control name cut); refused when off, refused outside a project's checkout or worktree; a missing binary and a failed start give their errors.
- web: the « Mode auto » preference parsed and remembered; the recap's folder for a worktree-only blueprint; the buttons' disabled state from the setting.
- browser (demo, 1280 and 375 px): CLI off, the three « Nouvelle session » buttons disabled with the hint; turn it on in « Réglages »; the window's « Lancer la session » opens the recap, « Retour » keeps the form, « Mode auto » stays on at the next window, « Lancer » closes with the toast.

## Progress
- [ ] Stage 1 — api
- [ ] Stage 2 — web
- [ ] Review
- [ ] Browser test
- [ ] Spec merged
