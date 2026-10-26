# Selo settings

Pages: none · Domain: `settings` (new), `app` · Components: `api`, `web`

## Spec delta
- settings + BR-01 — « Réglages » are the person's selo settings on this machine, for all their selo projects: the `SELO_` keys of the `env` block of Claude Code's user settings file (`settings.json` in `CLAUDE_CONFIG_DIR`, else `~/.claude`), the one file outside its own data Selo Ops writes (`session` BR-01); sessions opened afterwards read them, a session already open keeps its own.
- settings + BR-02 — The settings are the models preset `SELO_MODELS` (« Standard » `standard`, the default: opus to plan, implement and review, haiku to run and search; « Lean » `lean`: the same with sonnet to implement), one model per role `SELO_MODEL_{ROLE}` (planner, implementer, reviewer, runner, explorer: opus, sonnet, haiku or fable; absent: « Selon le preset »), `SELO_ROUTING` (`on`, else off) and `SELO_COMMIT` (`auto`, else ask), read as the selo plugin reads them: an unknown preset as « Standard ».
- settings + BR-03 — Saving reads the file again and changes only the settings the person changed: one set to « Standard », « Selon le preset », off or ask leaves `env`, any other is written; a role set by hand to its preset's model stays a key of its own; every other key of the file, and a setting not changed even with a value Selo Ops does not know, stays as it is, so that no hand edit and no write of Claude Code since the window opened is lost.
- settings + BR-04 — A missing file reads as every setting at its default, and saving creates it; a file that is not valid JSON, or whose root or `env` is not an object, is unreadable and never written.
- settings + Non-goal: « The project and local settings files of Claude Code, which can override these keys: only the user file is shown and written. »
- app ~ FR-05 — « A bell in the header, beside the theme switch, opens » → « A bell in the header, before « Réglages » (FR-08), opens »
- app + FR-08 — « Réglages » in the header, between the bell and the theme switch, opens a window, full screen on a phone, read from the file each time it opens (`settings` BR-01): the file's path; « Modèles des agents »: the preset « Standard » / « Lean » with what each sets, then one line per role (« Planifier », « Implémenter », « Relire », « Exécuter », « Chercher ») with its role, its agent and a menu « Selon le preset ({model}) », opus, sonnet, haiku, fable (`settings` BR-02); « Pendant le travail »: the switches « Router mes demandes vers pilot » and « Commiter sans me demander », each with its key and value; then « S'applique aux sessions ouvertes après l'enregistrement. ».
- app + FR-09 — A role set by hand carries « personnalisé » and an arrow back to « Selon le preset »; a model the menu does not offer shows as is, as the role's choice.
- app + FR-10 — Once a setting changed, the window shows « Écrit dans env à l'enregistrement » with the `SELO_` keys `env` will hold, and the count of unsaved changes; « Enregistrer » stays disabled until a change; « Annuler », « Fermer » and Échap close without writing and without asking.
- app + FR-11 — « Enregistrer » saves (`settings` BR-03), closes the window and shows the toast « Réglages enregistrés · pour les prochaines sessions »; a failed write keeps the window open, its error in a frame above the buttons.
- app + FR-12 — An unreadable file (`settings` BR-04) shows « Impossible de lire tes réglages. » with the file's path, the line and column of the error and « Corrige le fichier, puis rouvre cette fenêtre. », the settings disabled, « Enregistrer » disabled and « Annuler » reading « Fermer ».

## Mockup
[The « Réglages » window: unchanged, unsaved changes, saved, unreadable file, 360 px](../mockups/2026-10-26-settings.html)

## Business decisions
- Where it lives → a new domain sheet `settings` for the file's rules, the window in `app` (the header, on every page); this reverses `pilot-workflows`' "Selo Ops reads no settings file"; the help's « Réglages » section is left as is (still true).
- A setting brought back to its default → its key leaves `env` (absent is the default for selo; the file stays short); « Selon le preset » only, a role pinned to its preset's model stays pinned.
- A value Selo Ops does not know (preset, model, routing) → shown as selo reads it, left in the file unless the person changes that setting (no hand edit lost).
- Save → reads the file again and touches only the changed keys (Claude Code writes the same file, `/config` for one).
- Closing with unsaved changes → no confirmation, nothing written (a short form; the mockup has no such state).

## Technical defaults
- Settings file → `{CLAUDE_CONFIG_DIR or ~/.claude}/settings.json`, resolved in the API's config beside the other Claude Code paths and passed to the app the same way; the demo seeds and writes its own in its temporary folder, tests a temporary one: never the person's file.
- Contract → one read (path, state `ok` / `missing` / `unreadable` with line and column, the values as the file holds them) and one save taking only the changed keys, each a known `SELO_` key with an allowed value or a removal; anything else `400`, an unreadable file `409`, nothing written.
- Presets, roles and models → copied from the selo plugin's `manifest.mjs` into the API (a comment naming the source) and served with the read, the web's single source.
- Write → the whole file replaced atomically (temp file in the same folder, then rename), 2-space JSON, key order kept; no table, no migration.
- Web → a `settings` feature: the window on the shared `Modal`, `Segmented`, `Select`, `Switch`, `Toast`; the preview and the change count in a pure `.ts` module with its test.
- `settings` sheet's glossary, written at the merge → « réglages » `SeloSettings`, « preset » `preset`, « rôle » `role`, « personnalisé » `isCustom`.

### Decided during build
- Save contract and the defaults → a default value (`standard`, `off`, `ask`) is refused with `400`, only `null` removes a key (BR-03 held at the API, not only in the window).
- Unreadable file's position → from V8's message (line and column, or a position, or the end of the text); none for an unexpected token, the window then gives no line and column.
- A UTF-8 BOM before the JSON → read as no BOM; the file is written back without it.
- A non-string `SELO_` value → shown as its JSON text, left in the file unless changed.
- A failed read or write → `500` problem details naming the OS error; a save whose changes the file already holds writes nothing.
- A symlinked settings file → written through its link, its file mode kept (review).
- Each opening of the window → its own query key, never refetched under the person's edits; a save closes it, the next opening reads the file again.
- What each preset sets → written from the catalog the API serves (« opus pour planifier et relire ; sonnet pour implémenter ; … »), not a fixed text.
- The preview → the keys `env` will hold, a new value green and a changed one yellow (the delta tokens), a kept one muted; a removed key is simply absent.
- The buttons at the bottom → an optional `footer` of the shared `Modal`, which also fills the phone's height with its body.
- Closed while a save runs → « Annuler » disabled during it; Échap or « Fermer » close the window and the save still ends with its toast.
- Demo settings file → `model`, `permissions` and one `env` key beside the defaults, so that a save shows the other keys kept.

## Stages
1. api — `feat(selo-settings): api — read and save the person's selo settings`
2. web — `feat(selo-settings): web — the « Réglages » window in the header`

## Tests
- api: missing file → defaults, saving creates it; invalid JSON, root or `env` not an object → unreadable with line and column, save `409` and file unchanged; save keeps every other key and `env` entry; a default removes its key; a role pinned to its preset's model kept; an unknown value left when not changed; a key written to the file after the read kept; unknown key or value → `400`.
- web: preview and change count from the file's values and the edits; a role's effective model (preset, pinned, unknown).
- browser: demo at 1280 and 360 px — « Réglages » in the header, the window unchanged, a preset, two roles and routing changed with the preview and count, the arrow back to the preset, save and toast, reopened with the saved values; the unreadable state with the demo's file broken by hand.

## Progress
- [x] Stage 1 — api
- [x] Stage 2 — web
- [x] Review
- [x] Browser test
- [x] Spec merged
