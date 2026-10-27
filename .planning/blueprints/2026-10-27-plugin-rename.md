# Plugin rename

Pages: `sessions-live`, `help` · Components: `api`, `web`

The selo plugins were renamed: the workflow plugin `selo` is `selo-flow` (`/selo-flow:{skill}`, `selo-flow:reviewer`, `selo-flow:runner`), the ops export plugin `selo-ops` is `selo-feed`; `selo-ops` stays the name of this dashboard.

## Spec delta
- sessions-live ~ FR-02 — « … (`session` BR-01; « selo 2.2.0 · selo-ops 2.2.1 », every version of a plugin installed at several, highest first: « selo 2.2.0 / 2.1.0 ») … » → « … (`session` BR-01; « selo-flow 3.0.0 · selo-feed 3.0.0 », every version of a plugin installed at several, highest first: « selo-flow 3.0.0 / 2.6.0 ») … »
- sessions-live ~ FR-39 — « A session written by a selo-ops version … « Écrite par selo-ops 2.1.0, autre version que celle installée » … Claude Code lists no selo-ops. » → « A session written by a selo-feed version … « Écrite par selo-feed 2.1.0, autre version que celle installée » … Claude Code lists no selo-feed. »
- sessions-live ~ FR-19 — « … the version of the selo-ops plugin that wrote the session's export file (« selo-ops 2.2.1 », … » → « … the version of the selo-feed plugin that wrote the session's export file (« selo-feed 3.0.0 », … »
- sessions-live ~ FR-47 — « … `/selo:pilot {request}`, `/selo:build {blueprint}` … `/selo:pilot {blueprint} — autonomous` … `/selo:{skill}` … » → « … `/selo-flow:pilot {request}`, `/selo-flow:build {blueprint}` … `/selo-flow:pilot {blueprint} — autonomous` … `/selo-flow:{skill}` … »
- help ~ FR-03 — every prompt it gives, « `/selo:{skill} …` » (fastlane, blueprint, build, pilot, mockup) → « `/selo-flow:{skill} …` », the rest unchanged
- help ~ FR-18 — « `SELO_ROUTING=on` (a free change request goes to `/selo:pilot`; … » → « `SELO_ROUTING=on` (a free change request goes to `/selo-flow:pilot`; … »

## Business decisions
- Which plugins does the header list? → `selo-flow` and `selo-feed`, under their new names (the old names are no longer installed; today the header lists none)
- Are the old names still read? → no (selo 3.0.0 renamed them in place; a 2.x install shows nothing until updated, as an unreadable list does)
- Historical files under `.planning/` → the mockups get the new prompts and agent names (they are reread as references); the merged blueprints and the changelog stay as written (history, never edited after `Spec merged`)

## Technical defaults
- Kept as they are → the `selo:begin`/`selo:end` tags, the `selo:mockup` meta (the plugin keeps both), the `selo-ops` project name, the `~/.claude/selo` export folder, `.git/selo/slots`, the `SELO_*` keys
- The `InstalledPlugin` name enum → `selo-flow` | `selo-feed`; the handoff `openapi.json` and the web's generated schema follow
- Every copied prompt, help card, settings agent name, empty-state text and demo seed → the new names

## Stages
1. api — `fix(plugin-rename): api — read the selo-flow and selo-feed plugins`
2. web — `fix(plugin-rename): web — selo-flow prompts and selo-feed versions`

## Tests
- api: the installed plugins route returns `selo-flow` and `selo-feed` versions, ignores `selo` and `selo-ops`; the demo seeds the new ids
- web: the lane chooser, new-session commands and plugin text tests read `/selo-flow:` and `selo-feed`; the outdated warning compares with `selo-feed`
- browser: demo, header shows « selo-flow … · selo-feed … »; « Nouvelle session » and the help copy `/selo-flow:` prompts; 1280 px and 375 px

## Progress
- [x] Stage 1 — api
- [ ] Stage 2 — web
- [ ] Review
- [ ] Browser test
- [ ] Spec merged
