# Pilot workflows

Pages: `sessions-live`, `help` · Domain: `session` · Components: `api`, `web`

## Spec delta
- session ~ BR-22 — « A session's type of work is its current run's flow (« libre », fastlane, blueprint, autopilot), … and a session outside selo reads « hors selo » (BR-12). » → « A session's type of work is its current run's flow (« libre », fastlane, blueprint, pilot), « pilot » reading « pilot autonome » when the run's mode is autonomous, followed by « › {skill} » while a selo skill other than the flow runs (« pilot › fastlane », « pilot autonome › build », « libre › review », « libre › mockup »), as the export gives them; a fastlane run in its iterate mode (the run's mode) reads « fastlane › itération » while its loop runs: until its end's first mark past `code` (`tests` first); a run with no flow reads « libre », and a session outside selo reads « hors selo » (BR-12). »
- session ~ BR-18 — « a session outside selo (BR-12), a session written by an export older than 2.2.0, a run before its first stop, » → « a session outside selo (BR-12), a run before its first stop, »
- sessions-live ~ FR-24 — « (`session` BR-10); only exports older than 2.2.0 write such runs, for a background subagent's end or a subagent's hand-back. » → « (`session` BR-10). »
- sessions-live ~ FR-41 — « the section is left out for a session outside selo and for one written by an export older than 2.5.0. » → « the section is left out for a session outside selo and for a run with no history. »
- sessions-live ~ FR-10 — « in the list, violet marks only the « Action suivante » and the autopilot type of work (FR-29). » → « in the list, violet marks only the « Action suivante » and the pilot type of work (FR-29). »
- sessions-live ~ FR-29 — « « blueprint » teal, « autopilot » violet; » → « « blueprint » teal, « pilot » and « pilot autonome » violet; »
- sessions-live ~ FR-41 — « (fastlane, blueprint and build, autopilot in their lane's colour, » → « (fastlane, blueprint and build, pilot in their lane's colour, »
- sessions-live ~ FR-21 — « « Action suivante » is shown only when the export proposes a selo command, and nothing is run: » → « « Action suivante » is shown only when the export proposes a selo command, its resume prompt, else the first `Next:` line of the run's done footer (FR-48), and nothing is run: »
- sessions-live + FR-48 — In the detail, « Action suivante » lists, under the resume prompt when the export gives one, every `Next:` line of the current run's done footer as the export keeps them, in order, each with its summary, its command and « Copier »; a command already listed shows once.
- sessions-live ~ FR-44 — « « Faire » — « Confier à l'agent » (autopilot, chosen when the window opens), » → « « Faire » — « Confier à l'agent » (pilot autonome, chosen when the window opens), « Laisser selo choisir la voie » (pilot), »
- sessions-live ~ FR-45 — « autopilot starts from a request or from such a blueprint. Its options are switches named in words with their selo flag beside them: for autopilot from a request, … for autopilot, fastlane and build, « Sans test navigateur »; » → « « Confier à l'agent » starts from a request or from such a blueprint, « Laisser selo choisir la voie » from a request. Its options are switches named in words with their selo flag beside them: for « Confier à l'agent » from a request, « Lane » (« Au choix de l'agent », « Fastlane », « Blueprint ») and « S'arrêter au blueprint », disabled with « Fastlane »; for fastlane, « Mode itératif »; for build, « Une seule étape » with its number; for both pilot choices, fastlane and build, « Sans test navigateur »; »
- sessions-live ~ FR-46 — « then each option's flag (`— no browser`); » → « then each option's flag (`— no browser`), « Confier à l'agent » ending with `— autonomous`; »
- sessions-live - Non-goal: « The history of a subagent's run: an autopilot's main run already carries its subagents' skills. »
- sessions-live + Non-goal: « The history of a subagent's run: an autonomous pilot's main run already carries its subagents' skills. »
- help ~ FR-02 — « and the autopilot (the person leaves), with the prompt of each. » → « and the pilot (selo picks the lane and runs it in the session, ` — autonomous` when the person leaves), with the prompt of each. »
- help ~ FR-05 — « on the base branch, committed as the work goes; » → « on the base branch, committed as the work goes, a fastlane's commits on one yes of the person unless their `SELO_COMMIT` is `auto`; »
- help ~ FR-06 — « (fastlane, blueprint, build, autopilot, mockup, grill, review, try, run, setup) » → « (fastlane, blueprint, build, pilot, mockup, grill, review, try, run, setup) »
- help ~ FR-11 — « fastlane lime, autopilot violet and blueprint teal; » → « fastlane lime, pilot violet and blueprint teal; »
- help ~ FR-12 — « « Technique » the cards of FR-06 and FR-07. » → « « Technique » the cards of FR-06, FR-07 and FR-18. »
- help + FR-18 — The « Technique » tab's "Settings" section explains the person's two selo settings, both off by default, set in the `env` block of `~/.claude/settings.json` and read by the next new session: `SELO_ROUTING=on` (a free change request goes to `/selo:pilot`) and `SELO_COMMIT=auto` (a fastlane commits on the base branch without the person's yes).

## Business decisions
- Exports older than selo 2.6.0 / selo-ops 2.8.0 → not supported, no data taken over: the person clears the ops export before the first run (Selo Ops never writes it, `session` BR-01); Selo Ops' own data (archives, notes) is left as is.
- Type of work of a pilot run → « pilot › fastlane » interactive, « pilot autonome › build » autonomous.
- « Nouvelle session » → two choices: « Confier à l'agent » (`/selo:pilot … — autonomous`, chosen at opening, its lane options) and « Laisser selo choisir la voie » (`/selo:pilot {demande}`).
- `SELO_ROUTING` / `SELO_COMMIT` → explained in the help only; Selo Ops reads no settings file.
- The done footer's `Next:` lines → « Action suivante » falls back on the first, the detail lists them all.
- Pilot keeps autopilot's violet everywhere (help, sessions live, trail).

## Technical defaults
- API drops every reading of older exports: the deprecated `lane`, its flow and skill mapping, the ` — iterate` read from the request, the `autopilot` flow; `flow`, `skill`, `mode`, `trail` and `next` read as given.
- API session gains its next steps (summary, command) from the run's `next`, read leniently; `nextAction` = resume prompt, else the first one.
- Token `--lane-autopilot` renamed `--lane-pilot`; help content and catalog keys follow the rename.
- Demo seed: every session in the 2.8.0 shape (no lane-only run, no autopilot), an interactive pilot, an autonomous pilot on build, a job done with `Next:` lines; `api/openapi.json` regenerated.

## Stages
1. api — `feat(pilot-workflows): api — pilot flow, autonomous mode and the footer's next steps`
2. web — `feat(pilot-workflows): web — pilot in sessions live, the new-session window and the help`

## Tests
- api: type of work for pilot interactive and autonomous; a run with no flow → « libre »; iterate from `mode` only; next steps read, absent → none; next action falls back on the first next step; the legacy-reading tests removed.
- web: label and colour of « pilot » / « pilot autonome »; command of both pilot choices (lane, until blueprint, no browser, `— autonomous` last); trail colour of `pilot`; next steps listed once each.
- browser: demo at 1280 and 375 px — pilot rows violet, the window's two pilot choices and their commands, a job done's next steps in the detail, the help's pilot lane and « Réglages » section.

## Progress
- [ ] Stage 1 — api
- [ ] Stage 2 — web
- [ ] Review
- [ ] Browser test
- [ ] Spec merged
