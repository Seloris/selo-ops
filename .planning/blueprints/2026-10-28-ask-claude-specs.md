# Ask Claude: all specs, tokens

Pages: `projects` · Domain: `question` · Components: `api`, `web`

## Spec delta
- question ~ BR-01 — « about one of its blueprints, page specs or domain sheets, or about the whole project; … (`project` BR-01; the base checkout for the whole project), » → « about one of its blueprints, page specs or domain sheets, about all its page specs and domain sheets together, or about the whole project; … (`project` BR-01; the base checkout for all its specs and for the whole project), »
- question ~ BR-03 — « A question on a file is a preset, « Explique-moi vite » (what the file says and why, briefly, in plain words) or « Résume » (its summary in a few points), or a free text; a question on the whole project is a free text; » → « A question on a file is the preset « Explique-moi vite » (what the file says and why, briefly, in plain words) or a free text; a question on all the specs or on the whole project is a free text; »
- question ~ BR-04 — « then « Répondu » with its answer, its model and its duration, » → « then « Répondu » with its answer, its model, its duration and its tokens by kind (« Entrée », « Cache lu », « Cache écrit », « Sortie », all the run's models together, as the run reports them; none for an answer kept without them), »
- projects ~ FR-20 — « offers « Explique-moi vite » and « Résume », each sent at a click, » → « offers « Explique-moi vite », sent at a click, »
- projects ~ FR-21 — « « Répondu » with its answer formatted as FR-13, its model and its duration; » → « « Répondu » with its answer formatted as FR-13, its model, its duration and its total tokens (`question` BR-04's four kinds summed, abbreviated as `sessions-live` FR-35), each kind's count in the tooltip, none when the answer kept no tokens; »
- projects + FR-23 — « Demander à Claude » in the « Specs » section's header opens in the side panel (FR-10) the questions on all the project's specs: a free-text field with « Envoyer » and the questions asked on all its specs (FR-21) (`question` BR-01).

## Business decisions
- Tokens → the total beside the model and the duration, the four kinds in the tooltip, on every answered question (files, all specs, whole project); no cost in $ (misleading on a subscription).
- All specs → a new target with its own history, asked from the « Specs » section's header; the whole-project question stays as it is.
- « Résume » → the button goes, and the questions already asked with it are deleted (a migration), so no orphan preset is left.

## Technical defaults
- Usage → the four kinds summed over the JSON result's `modelUsage` (every model of the run), kept in four nullable columns of `questions`; older rows keep null.
- Target → a new kind `specs` (no path) beside `blueprint`, `sheet`, `project`; `GET` / `POST /v1/projects/{id}/questions` take `kind=specs` to tell it from the whole project; a preset on it `400`.
- Prompt → for `specs`: read every file of `.planning/pages/` and `.planning/domain/` and answer from them.
- Preset `summary` → removed from the contract; the migration deletes its rows.
- Address → `?ask=specs` beside `?ask=project`, so that a reload keeps the panel.
- Demo → one answered question on all specs with its tokens; the canned answers carry tokens, one older answer none.
- `question` glossary at the merge → « préréglage »: « Explique-moi vite » only; « cible »: adds all the specs.

### Decided during build
- Contract → `kind: "specs"` in the ask's body and the list's query; `kind` with a path `400` on both.
- Migrations → one generated (the four token columns), one custom deleting the `summary` rows, so the generated ones stay untouched.
- Tokens type → the sessions' `Tokens` schema reused, so the web reads one shape for a session's and an answer's tokens.

## Stages
1. api — `feat(ask-claude-specs): api — questions on all specs, tokens kept, « Résume » dropped`
2. web — `feat(ask-claude-specs): web — « Demander à Claude » on the specs, tokens on each answer`

## Tests
- api: usage summed from a two-model result and kept; a result with no `modelUsage` → null tokens; ask on `specs` → `202`, listed apart from the whole project; a preset on `specs` or `summary` anywhere → `400`; the migration deletes the `summary` rows; the `specs` prompt names `.planning/pages/` and `.planning/domain/`.
- web: tokens label abbreviated, tooltip with four kinds, none when null; the « Questions » tab offers « Explique-moi vite » alone.
- browser: demo at 1280 and 360 px — « Demander à Claude » on « Specs », ask, « En cours » to « Répondu » with its tokens and tooltip; a blueprint's tab without « Résume »; the whole project's questions unchanged.

## Progress
- [x] Stage 1 — api
- [ ] Stage 2 — web
- [ ] Review
- [ ] Browser test
- [ ] Spec merged
