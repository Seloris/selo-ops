# Session usage

Pages: `sessions-live` · Domain: `session` · Components: `api`, `web`

## Spec delta
- session + BR-18 — A session's and a run's usage (API calls, tokens by kind: « Entrée », « Cache lu », « Cache écrit », « Sortie », and their split per model) are read from the export only, never counted by Selo Ops; a session outside selo (BR-12), a session written by an export older than 2.2.0, a run before its first stop, a subagent still working and a subagent stopped by Échap have none and show « — ».
- session + BR-19 — A run whose figures the export has not settled yet shows them tagged « provisoire », since they may still grow; a run whose figures cover only the end of an oversized transcript shows them tagged « partiel : 32 derniers Mo ».
- session + BR-20 — A session's model is the export's, else the top model of its latest main run that has usage, so that the list, the card and the detail agree; a subagent's model is the top model of its own usage (its real model).
- sessions-live ~ FR-13 — « … what is awaited (or what the session does when nothing is), the model and effort, … » → « A card adds the whole request, what is awaited (or what the session does when nothing is), the model (`session` BR-20) with the session's total tokens (the four kinds summed, `session` BR-18) and effort, the permission mode, whether it can be closed, and the « Ouvrir », « Action suivante » and « Archiver » buttons. »
- sessions-live ~ FR-19 — « … the subagents of the current run (type, task, state); … the model (« — » when unknown), … » → « The detail shows the state and tag, the request, project, branch, type, the day and time the session was created (`session` BR-15; « créée le 22 oct. à 17:41 », with the year when it is not the current one) and age; the whole awaited text (a commit with its body); « Peut-on fermer la session ? » with « Oui, rien ne bloque » or « Pas encore » and its blockers (`session` BR-06), or « Inconnu hors selo » with no blocker for a session outside selo; the recap and commits of a finished run; the subagents of the current run (type, task, state, real model and total tokens, `session` BR-20, BR-18); the files touched; the model (`session` BR-20, « — » when unknown), effort, permissions, blueprint, folder and session id. »
- sessions-live ~ FR-30 — « Wherever a session outside selo (`session` BR-12) shows, its effort and permissions read « — » and … » → « Wherever a session outside selo (`session` BR-12) shows, its effort, permissions, total tokens and usage (`session` BR-18) read « — » and its recap, commits, subagents, files touched and blueprint are left out, since only the export gives them. »
- sessions-live + FR-32 — « Consommation de la session » shows the session's API calls and its four token kinds in separate columns, then one row per model with its calls and tokens, the most tokens first (`session` BR-18).
- sessions-live + FR-33 — « Consommation du tour » shows the current main run's calls, four token kinds and models like FR-32, its tags (`session` BR-19), its 5 most called tools (the advisor included) and its 5 most loaded skills, each with its count and how it was loaded (« outil », « commande », « préchargée »), then « + N autres ».
- sessions-live + FR-34 — Inside « Consommation du tour », « Demandes », folded by default, lists one line per prompt of the run, oldest first: its time (« — » when unknown), calls and tokens; when the run had more than 50 prompts, a note says only the latest 50 are listed, the run's totals staying exact.
- sessions-live + FR-35 — Token counts read abbreviated (« 34 k », « 1,2 M »), the exact count in the tooltip.
- sessions-live ~ FR-24 — « A request of which the export holds no readable text shows « Demande non lisible dans l'export ». » → « A request of which the export holds no readable text shows « Demande non lisible dans l'export »; only exports older than 2.2.0 write such runs, for a background subagent's end or a subagent's hand-back. »

## Business decisions
- Cache tokens → four separate columns in the detail, not « dont cache » (cache reads dominate a long run; folded they would hide it)
- Number format → abbreviated, exact count in a tooltip (the counts reach millions)
- Where tokens show → the card's total and the detail; the 36 px row (FR-11) unchanged (no room)
- Tools and skills per run → top 5 each, then « + N autres » (enough to see the run's shape)
- FR-24 → no UI change, the case kept for 1.0.0 sessions (their files keep the empty runs)

### Decided during build
- How to tell a run had more than 50 prompts → the note shows when it lists 50 prompts whose calls sum below the run's (the export keeps no count of the dropped ones; exactly 50 prompts holding every call shows no note)
- The card's total with no usage → « — tokens » after the model (BR-18's « — », the unit kept so the figure reads as tokens)
- A session outside selo in the detail → both usage sections shown with « — » (BR-18 says it has none, rather than hiding the sections); `~ FR-30` added to the delta
- Review: BR-18 also names a run before its first stop and a subagent still working among the cases with no usage (the export leaves them null; the person would otherwise wonder at « — » on a fresh session)
- Review: a run whose figures are partial never shows the over-50 note (its cut slice holds calls before its first whole prompt, which would trigger it falsely)

## Technical defaults
- Contract → `Tokens`, `Usage`, `RunUsage` as OpenAPI components; `Session` gets `usage` and `runUsage` (current main run), each subagent `model` and `usage`, all nullable (absent and null both → null); `transcriptFrom` not read; served by the list route, no detail endpoint (the 5 s poll carries them); handoff regenerated
- Parsing → `usage` read leniently (`.catch(null)`, `how` as a string kept if unknown): a malformed usage never drops the session file (`readFolder` skips a file that does not parse)
- Fallback model → in the API: export `model`, else the latest run with no `agentId` whose usage has a `byModel[0]`; an outside session keeps its transcript's model
- Total tokens → input + cacheRead + cacheWrite + output
- Format → below 1 000 exact; k and M in French (comma, narrow space), one decimal under 10 k / always for M; exact count with spaces in `title`
- Detail → two new sections in `DETAIL_SECTIONS` (`usage`, `runUsage`) after the subagents, foldable (FR-31); « Demandes » folded by its own local state, not remembered
- Glossary at the merge → `consommation` / `usage`, `tokens` / `Tokens` (four kinds), `modèle réel` (the delta grammar has no glossary line)
- Demo and API fixtures → a 2.2.0 session with usage, a run `settled: false`, a run `partial: true`, a prompt with `at: null`, a subagent with usage null, a 1.0.0 session with no `usage` key, a session with `model: null` using the fallback; a run with over 50 prompts in the demo

### Decided during build
- A subagent's `usage` in the contract → `Usage` (calls, tokens, byModel), not `RunUsage` (its tools and skills are not shown; keeps the 5 s poll small)
- "Latest" main run for the model fallback → the one with the latest `since`, whatever the export's order of `runs` (order-independent)
- Demo run "over 50 prompts" → 50 prompts listed (the most the export keeps), the run's calls and tokens above their sum (the export cannot hold more)
- Section hue → a new `--hue-usage` (fuchsia, light and dark) for both usage sections, the gauge icon (the other hues are taken; amber and rose mark states)
- Format edges → 1 000 to 9 949 with one decimal, 9 950 and up rounded (« 10 k », never « 10,0 k »); 999 500 and up in millions; call counts exact, with French separators
- Prompt time → hour and minute, local time, no day (a run is one sitting)
- Subagent line → its state, then its real model, then its total tokens, each « — » when unknown
- A skill loaded in a way the UI does not know → shown as the export names it

## Stages
1. api — `feat(session-usage): api — session, run and subagent usage from the export`
2. web — `feat(session-usage): web — usage sections in the detail, total tokens on the card`

## Tests
- api: usage mapped for session, current run, subagent; settled/partial passed through; prompt `at` null; subagent usage null; 1.0.0 file (no key) → null and still listed; malformed usage → null and still listed; model null → fallback from the latest main run, not a subagent's; no usage anywhere → model null; outside session → usage null
- web: pure modules: number format (999, 34 000, 1 234 567, exact tooltip), top 5 with « + N autres », total of four kinds, folded sections parsing with the new ids
- browser: demo at 1280×800 and 390 wide: card total next to the model, detail session and run usage, tags « provisoire » / « partiel », prompts folded then opened with the over-50 note, subagent with « — », 1.0.0 session « — »

## Progress
- [x] Stage 1 — api
- [x] Stage 2 — web
- [x] Review
- [x] Browser test
- [ ] Spec merged
