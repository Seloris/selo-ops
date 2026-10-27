# Ask Claude

Pages: `projects` · Domain: `question` (new), `session` · Components: `api`, `web`

## Spec delta
- question + BR-01 — A question is asked of one project, about one of its blueprints, page specs or domain sheets, or about the whole project; Selo Ops answers it with a Claude Code run that takes no input from anyone (headless), in the checkout holding its file (`project` BR-01; the base checkout for the whole project), on the model Sonnet, so that the person gets an analysis without opening a session.
- question + BR-02 — The run only reads: it may read and search the project's files, never writes one, runs no command and loads no hook nor plugin, so that it is no selo session and leaves the project as it found it.
- question + BR-03 — A question on a file is a preset, « Explique-moi vite » (what the file says and why, briefly, in plain words) or « Résume » (its summary in a few points), or a free text; a question on the whole project is a free text; a free text is trimmed and holds 1 to 2000 characters; the answer is written in French.
- question + BR-04 — A question is « En cours » while its run works, then « Répondu » with its answer, its model and its duration, or « Échec » with its reason: a run longer than 5 minutes is stopped, and a run cut by Selo Ops stopping reads « Interrompue » once Selo Ops starts again.
- question + BR-05 — At most 3 runs work at once, all projects together; a fourth question is refused and nothing is kept.
- question + BR-06 — Questions and their answers are Selo Ops' own data (`session` BR-01), kept per project and per file until the person deletes one, even once the file is gone; deleting a question « En cours » stops its run.
- question + Non-goal: « A conversation: one question gets one answer, with no follow-up and no answer shown while it is written. »
- question + Non-goal: « Choosing the model: Sonnet for every question. »
- session ~ BR-12 — « …it is listed only while its process runs, is never closed, and leaves the list with no history when the process ends. » → « …it is listed only while its process runs, is never closed, and leaves the list with no history when the process ends; the run answering a question (`question` BR-01) is never listed. »
- projects + FR-19 — « Demander à Claude » in the project's view opens in the side panel (FR-10) the questions on the whole project: a free-text field with « Envoyer » and the project's questions on the whole project (FR-21).
- projects + FR-20 — The « Questions » tab of a blueprint's or a sheet's panel offers « Explique-moi vite » and « Résume », each sent at a click, a free-text field with « Envoyer », then the questions on this file (FR-21) (`question` BR-03).
- projects + FR-21 — Questions show newest first, each with its text or its preset's name, its age and its state (`question` BR-04): « En cours » with the time elapsed, refreshed every 2 s while one is running; « Répondu » with its answer formatted as FR-13, its model and its duration; « Échec » with its reason; « Supprimer » deletes it after a confirmation (`question` BR-06); none says « Aucune question pour l'instant ».
- projects + FR-22 — « Envoyer » stays disabled while the text is empty or past 2000 characters, with its count; a refused question (`question` BR-05) or a failed send keeps the text and says why under the field.
- projects ~ FR-11 — « then two tabs, « Résumé » open first and « Texte complet » (its whole text), » → « then three tabs, « Résumé » open first, « Texte complet » (its whole text) and « Questions » (FR-20), »
- projects ~ FR-12 — « then the same two tabs: » → « then the same three tabs: »
- projects ~ Non-goal: « Editing a file or running a selo command: the page reads, and copies prompts only. » → « Editing a file or running a selo command: the page reads, copies prompts and asks questions (`question` BR-02) only. »

## Business decisions
- Where → the projects page, the only one showing specs and blueprints: a « Questions » tab on a blueprint's and a sheet's panel, « Demander à Claude » in the project's view for the whole project; « Idées » and « Dette technique » get none (not specs); a new domain sheet `question`.
- Presets → two, « Explique-moi vite » and « Résume », on a file only; the whole project takes free text (a preset there has no clear target).
- The run → headless Claude Code on Sonnet, fixed for now (no setting), read-only, no hook nor plugin, hidden from Sessions live: a question must never turn into a selo session, a commit or a routed pilot.
- History → kept per file and per project until deleted; one question, one answer, no follow-up and no streaming (first version).
- Limits → 3 runs at once, 5 minutes per run, 2000 characters (cost and machine load kept bounded).

## Technical defaults
- Storage → one `questions` table (project, target kind and path or none, preset or text, state, answer, error, model, duration, run's session id, asked and answered times) and its migration; at start-up every « En cours » row becomes « Échec » « Interrompue ».
- Contract → `GET /v1/projects/{id}/questions` (filtered by target, newest first), `POST` the same (target, preset or text) → `202` with the question « En cours », `DELETE /v1/questions/{id}`; unknown project or file `404`, the limit `409`, validation `400`.
- Launch → `claude -p` through `spawn` (no shell, the prompt on stdin), `--model sonnet --output-format json`, `--allowedTools Read,Grep,Glob`, `--settings` with `disableAllHooks`, `--session-id` a UUID Selo Ops generates and keeps; binary `claude` on PATH, else `CLAUDE_BIN` in the API's config; missing binary or non-zero exit → « Échec » with the reason; model and duration from the JSON result.
- Sessions live → the outside-selo listing skips the session ids of the questions' runs.
- Runner → injected into the service; tests and the demo use a fake (the demo answers its canned text after 3 s, one demo question fails), never the real `claude`.
- Prompt → an English template in code naming the target's path and kind, the preset's instruction or the text, read-only, answer in French Markdown.
- Web → in the `projects` feature: a `QuestionList` and `AskForm` on the shared UI, a data hook polling every 2 s while a question runs; labels and elapsed time in a pure `.ts` module with its test.
- `question` sheet's glossary, written at the merge → « question » `Question`, « préréglage » `preset`, « cible » `target`.

### Decided during build
- Read-only flags → `--tools Read,Grep,Glob` beside `--allowedTools`, `--permission-mode dontAsk`, `--disable-slash-commands`, `--strict-mcp-config`, with `--settings {"disableAllHooks":true}` (`--allowedTools` only pre-approves a tool, `--tools` removes the others; the plugins' skills and MCP servers go too, their hooks with `disableAllHooks`).
- Run's environment → `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SSE_PORT` dropped (Claude Code refuses to start inside a session's environment, an API started from a session).
- Windows → `spawn` without a shell finds `claude.exe` on the PATH; a `claude.cmd` cannot start without a shell, `CLAUDE_BIN` then names the executable; `ENOENT`, `EINVAL`, `EACCES` → « Échec » `missing-binary` (no shell ever: the prompt is the person's text).
- Status file of `claude -p` → not seen on this machine (only the desktop app's interactive ones); the outside-selo listing skips every stored question's run session id, so it holds either way.
- Failure → stored as a code (`interrupted`, `timeout`, `missing-binary`, `run-failed`) and Claude Code's own words; the web words the code in French.
- Limit → counted in memory and reserved before the insert, so two asks at once never pass 3; the 5-minute stop aborts the run, which kills the process.
- Targets → only a blueprint or a sheet the export lists (a worktree-only blueprint in its worktree); ideas, debt, changelog or any other path `404`.
- Demo → `ledger-api`: « Résume » answered and a free text failed (`run-failed`) on `2026-10-20-monthly-balance`, a free text answered on the project.
- Stopping a run → the process tree is killed (`taskkill /T` on Windows, no shell) and its place frees once the process is gone, not at the abort (`question` BR-05 holds while it dies); a non-zero exit keeps the JSON result's own words.
- « Demander à Claude »'s address → `?ask=project` beside `?project=`, as `?file=` opens a file (projects FR-10), so that a reload keeps the panel.
- Refusals → the web words the status in French (`409` « 3 questions sont déjà en cours », `404`, `400`), never the API's English text.
- Web data → one `useQuestions` hook holds the target's query and its two mutations, sharing one query key (not split in `use…Query` / `use…Mutation`).

## Stages
1. api — `feat(ask-claude): api — ask a headless Claude about a spec, a blueprint or the project`
2. web — `feat(ask-claude): web — the « Questions » tab and « Demander à Claude »`

## Tests
- api: ask → `202` « En cours », fake run ends « Répondu » with answer, model, duration; run error and timeout → « Échec »; fourth running → `409`, nothing kept; unknown project or file `404`; empty or 2001-char text, preset on the whole project → `400`; list by target newest first; delete a running one stops its run; start-up marks « En cours » rows « Interrompue »; spawn arguments read-only, Sonnet, hooks off, prompt with the target's path; the outside-selo listing skips a question's run.
- web: state labels and elapsed time; « Envoyer » disabled empty or past 2000.
- browser: demo at 1280 and 360 px — a blueprint's « Questions » tab, « Résume » from « En cours » to « Répondu »; a free text on a sheet; « Demander à Claude » on the project; the failed demo question; « Supprimer » with its confirmation.

## Progress
- [x] Stage 1 — api
- [x] Stage 2 — web
- [x] Review
- [x] Browser test
- [ ] Spec merged
