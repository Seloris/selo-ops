# Usage stats

Pages: `stats` (new, `Route: /stats`) · Domain: `app` · Components: `api`, `web`

## Spec delta
- app ~ FR-03 — « the tabs « Live » (Sessions live, the default view), « Projets » and « Debug », « Aide », … « Projets » opens the projects page, and « Debug » » → « the tabs « Live » (Sessions live, the default view), « Projets », « Stats » and « Debug », « Aide », … « Projets » opens the projects page, « Stats » the stats page, and « Debug » »
- stats + FR-01 — The header reads « Stats » with the period and the project shown; the page refreshes itself every 30 s and shows « Mis à jour il y a X s ».
- stats + FR-02 — A period switch « 7 jours » (the default), « 30 jours », « 90 jours », « Tout » (a period of N days is today and the N − 1 days before, in the browser's time zone) and a project menu, « Tous les projets » first, then the projects with usage, filter the whole page; the address keeps both.
- stats + FR-03 — Tiles give, over the period and the project chosen: total tokens (the four kinds summed, abbreviated as `sessions-live` FR-35), API calls (the sessions' calls; a question counts none), sessions with usage, answered questions with tokens, « Sortie » tokens and the cache share (« Cache lu » over « Entrée », « Cache lu » and « Cache écrit » together, in percent).
- stats + FR-04 — A run's usage, main run or subagent, counts on the day its run started, a question's (`question` BR-04) on the day it was asked; the part of a session's usage the export keeps no run for (its oldest runs dropped) has no day and counts only under « Tout », as « Non daté », so that the totals under « Tout » match the sessions' own (`session` BR-18).
- stats + FR-05 — « Tokens par jour » shows one bar per day of the period, days with none at zero, stacked by kind in four colours with a legend; « Tout » beyond 90 days shows one bar per week starting on Monday; hovering a bar shows its date, each kind's count and its calls.
- stats + FR-06 — « Par projet » lists the projects by tokens, most first, each with a bar relative to the first, its share of the total, its calls and its sessions; a click on one sets the project menu to it.
- stats + FR-07 — « Par modèle » lists the models the same way (tokens, bar, share, calls); tokens of calls with no model count in the totals only.
- stats + FR-08 — « Par type de travail » splits the tokens into « libre », fastlane, blueprint, pilot (autonomous or not), « Questions » (asked from Selo Ops) and, under « Tout », « Non daté » (FR-04), with their share; a subagent's tokens count with the main run it ran under.
- stats + FR-09 — « Sessions les plus gourmandes » lists the 10 sessions with the most tokens in the period, closed and archived ones included: request (`session` BR-10), project, type of work, model (`session` BR-20), tokens, calls and last activity; a click opens the session's detail on Sessions live (`sessions-live` FR-18).
- stats + FR-10 — With no usage in the period, the sections read « Aucune consommation sur cette période. »; the page shows a loading state, and an error state that keeps the filters.
- stats + FR-11 — At phone width the tiles wrap, the sections stack, and the daily chart scrolls sideways inside its section, never the page.
- stats + Non-goal: « A cost in dollars: misleading on a subscription. »
- stats + Non-goal: « History beyond what the export keeps: a session whose transcript is gone (`session` BR-14) leaves the stats, and sessions outside selo have no usage (`session` BR-12). »

## Business decisions
- Page → « Stats » at `/stats`, a header tab between « Projets » and « Debug » (the request; the sibling of the projects page).
- Source → the export's figures only, summed per run, nothing kept by Selo Ops (`session` BR-18 holds: summing what the export says is no counting; a snapshot table would duplicate the export and drift).
- Dating → a run counts on the day it started, the dropped runs' part « Non daté » under « Tout » only (the export holds no finer time for a whole run; totals stay exact).
- Questions' tokens → included, as their own type of work « Questions » and in their project (they are tokens the person spends through Selo Ops).
- Breakdowns → per day, per project, per model, per type of work, top 10 sessions; period 7 j by default, a project filter; no cost (same choice as `ask-claude-specs`).

### Decided during build
- The undated part in « Par type de travail » → its own line « Non daté » under « Tout » (its runs' flow is gone with them; FR-04 already names it so).
- A question's API calls → none counted: the « Appels API » tile and the calls columns hold the sessions' calls only (the questions table keeps no call count).
- « Questions répondues » → the answered questions that kept their tokens only (an older answer kept without them, `question` BR-04, has nothing to count).
- These three decisions are written into FR-03 and FR-08's `+` lines above (review).

## Technical defaults
- Endpoint → `GET /v1/stats?period=7d|30d|90d|all&project={id}&tz={IANA zone}`, one response (totals, buckets, projects, models, flows, top sessions), computed per request from the export reader and the questions repository; no table, no migration; a bad period or zone `400`; handoff regenerated.
- Time zone → the browser's IANA zone sent as `tz`, day and week bounds computed in it in the API.
- Sessions → the export's files minus those whose transcript is gone; a session counts in a period when one of its runs with usage started in it; its project as `session` BR-05.
- Undated part → the session's usage minus the sum of its runs' (calls, kinds, per model), floored at zero; a session with no usage key gives none.
- Subagent's type of work → the main run of the latest `since` not after its own, else « libre »; `pilot` with mode `autonomous` counts as pilot; an unknown flow is kept by its name.
- Questions → the answered ones with tokens, of the period and project; their `model` column feeds « Par modèle ».
- Chart → hand-made CSS/SVG bars, no chart library; new tokens for the four kinds and `--hue-stats`, light and dark, in overrides.css; formats reuse the sessions' `usage.ts`.
- Address → `?period=30d&project={id}`; the default period is left out of it.
- Demo → sessions across 90 days, three projects, two models, every flow, a session with dropped runs, a session archived, answered questions with tokens.

### Decided during build
- Project id → the export key of the project's base checkout, as `/v1/projects` gives it (the questions are kept by that key; a session's repository is mapped to it); its name the manifest's, else the folder's.
- Project menu → `projectOptions`: the projects with usage in the period, whatever the project chosen, by name (the menu never shrinks to the chosen one).
- `tz` absent → `UTC`; present and unknown → `400`.
- A top session's type of work → its current run's flow, skill and mode, as `session` BR-22 reads them.
- Demo history → 14 finished sessions over 118 days, closed and archived, in `seed/demo.stats.ts` (the live list stays as it is; past 90 days, « Tout » shows weeks).
- The four kinds' colours → the existing `--kind-*` tokens of the session detail's usage bars, not new ones; only `--hue-stats` (sky) is added.
- The undated part in the chart → no bar: a note under the chart gives its tokens and calls under « Tout »; a weekly chart says « Une barre par semaine, à partir du lundi ».
- The cache share tile → whole percent, « — » when nothing was read.
- A bar's tooltip → on hover and on keyboard focus; the bars are buttons.
- A top session → opens `/?session={id}`, the address Sessions live already reads for its detail.

## Stages
1. api — `feat(usage-stats): api — usage stats per day, project, model and type of work`
2. web — `feat(usage-stats): web — « Stats » page with daily chart and breakdowns`

## Tests
- api: a run at 23:30 UTC counts on the next day in Europe/Paris; period bounds (7 days includes today and 6 before); project filter; undated part only under `all`, floored at zero; subagent tokens under its main run's flow; questions counted, those without tokens not; outside selo and transcript-gone sessions left out; models split; top 10 ordered; weeks beyond 90 days under `all`; bad `period` or `tz` → `400`; empty export → zero totals, every day present.
- web: pure modules: address ↔ filters, cache share in percent, bar heights against the top bucket, empty-period detection.
- browser: demo at 1280 and 360 px — « Stats » tab, switch 7 j / 30 j / Tout, project filter by menu and by a row click, tooltip on a bar, top session opening its detail on Live, empty period message.

## Progress
- [x] Stage 1 — api
- [x] Stage 2 — web
- [x] Review
- [x] Browser test
- [x] Spec merged
