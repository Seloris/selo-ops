# Ideas

The person's ideas for this project, not yet specified. Grouped by scope: one `## <scope>` section per component, feature or `app`, a new scope's section added at the bottom; in a section, new items appended at the bottom, no priorities or metadata. Format: `- {YYYY-MM-DD} — **<Short title>:** <The idea in a sentence or two, as the person put it>.`

## sessions-live

- 2026-10-22 — **Session token count:** See the number of tokens a session used.
- 2026-10-22 — **Session creation date and duration:** See when a session was created and its total duration.
- 2026-10-23 - **Session type** when a session started with "libre" status but it became a fastlane or autopilot, change the type
- 2026-10-23 - **Session step** when a session is doing a known type (like build or blueprint), show it (might need a selo-flow update)
- 2026-10-24 — **Notify when a session waits:** A browser notification when a session becomes « à traiter » (waiting for an answer, a permission or a commit), so the list need not be watched with many sessions in parallel.
- 2026-10-24 — **Archive sessions in bulk:** Archive every Job done session in one action (a button on the block, or a checkbox per row); maybe auto-archive after some hours in Job done.
- 2026-10-24 — **Session type inferred from its skill:** Infer a run's type from the skill it launched, else show « libre », since many runs carry no type today.

## app

- 2026-10-22 — **Terminal mode:** A terminal mode in the application, so that sessions are driven from the terminal instead of from Claude Code, which would allow more features, such as creating sessions directly in the tool.
- 2026-10-24 — **Daily delivery journal:** A page listing what was delivered per day and per project: the commits of the JOB DONE footers and the FRs they touched.
- 2026-10-24 — **Usage across sessions:** Token usage summed per day, per project and per type of work (free, fastlane, build), to compare what each way of working costs.
- 2026-10-24 — **Start a session on a skill:** Buttons in the app that launch a prompt in a new session, to force a skill (fastlane, blueprint, autopilot…).

## selo

- 2026-10-24 — **Mockup first:** Handle changes through a mockup first, iterated and approved before any code, maybe as its own skill.
- 2026-10-24 — **Iterative lane:** A lane in iterative mode that does not commit at each change, and commits only at the end, once this particular flow is validated.

