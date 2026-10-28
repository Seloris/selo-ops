# Stats

Route: `/stats` · Domain: `session`, `question`, `app`

What the developer's sessions and questions consumed, read from the ops export, so that the person sees where their tokens go: per day, per project, per model and per type of work.

## Header

- **FR-01** — The header reads « Stats » with the period and the project shown; the page refreshes itself every 30 s and shows « Mis à jour il y a X s ».
- **FR-02** — A period switch « 7 jours » (the default), « 30 jours », « 90 jours », « Tout » (a period of N days is today and the N − 1 days before, in the browser's time zone) and a project menu, « Tous les projets » first, then the projects with usage, filter the whole page; the address keeps both.

## Tiles

- **FR-03** — Tiles give, over the period and the project chosen: total tokens (the four kinds summed, abbreviated as `sessions-live` FR-35), API calls (the sessions' calls; a question counts none), sessions with usage, answered questions with tokens, « Sortie » tokens and the cache share (« Cache lu » over « Entrée », « Cache lu » and « Cache écrit » together, in percent).
- **FR-04** — A run's usage, main run or subagent, counts on the day its run started, a question's (`question` BR-04) on the day it was asked; the part of a session's usage the export keeps no run for (its oldest runs dropped) has no day and counts only under « Tout », as « Non daté », so that the totals under « Tout » match the sessions' own (`session` BR-18).

## Daily chart

- **FR-05** — « Tokens par jour » shows one bar per day of the period, days with none at zero, stacked by kind in four colours with a legend; « Tout » beyond 90 days shows one bar per week starting on Monday; hovering a bar shows its date, each kind's count and its calls.

## Breakdowns

- **FR-06** — « Par projet » lists the projects by tokens, most first, each with a bar relative to the first, its share of the total, its calls and its sessions; a click on one sets the project menu to it.
- **FR-07** — « Par modèle » lists the models the same way (tokens, bar, share, calls); tokens of calls with no model count in the totals only.
- **FR-08** — « Par type de travail » splits the tokens into « libre », fastlane, blueprint, pilot (autonomous or not), « Questions » (asked from Selo Ops) and, under « Tout », « Non daté » (FR-04), with their share; a subagent's tokens count with the main run it ran under.

## Top sessions

- **FR-09** — « Sessions les plus gourmandes » lists the 10 sessions with the most tokens in the period, closed and archived ones included: request (`session` BR-10), project, type of work, model (`session` BR-20), tokens, calls and last activity; a click opens the session's detail on Sessions live (`sessions-live` FR-18).

## Whole page

- **FR-10** — With no usage in the period, the sections read « Aucune consommation sur cette période. »; the page shows a loading state, and an error state that keeps the filters.
- **FR-11** — At phone width the tiles wrap, the sections stack, and the daily chart scrolls sideways inside its section, never the page.

## Non-goals

- A cost in dollars: misleading on a subscription.
- History beyond what the export keeps: a session whose transcript is gone (`session` BR-14) leaves the stats, and sessions outside selo have no usage (`session` BR-12).

Retired:
