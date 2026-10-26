# Settings

What holds for the person's selo settings, whatever the page: its terms and its rules, as Selo Ops reads and writes them in Claude Code's user settings file. Pages cite these `BR` ids, never restate them.

## Glossary

| Business term | Identifier | Business meaning |
|---|---|---|
| `réglages` | `SeloSettings` | The person's selo settings on this machine, for all their selo projects. |
| `preset` | `preset` | A set of models, one per role: « Standard » or « Lean ». |
| `rôle` | `role` | A kind of agent selo runs: planner, implementer, reviewer, runner, explorer. |
| `personnalisé` | `isCustom` | A role set by hand to a model of its own, whatever its preset gives it. |

## Business rules

- **BR-01** — « Réglages » are the person's selo settings on this machine, for all their selo projects: the `SELO_` keys of the `env` block of Claude Code's user settings file (`settings.json` in `CLAUDE_CONFIG_DIR`, else `~/.claude`), the one file outside its own data Selo Ops writes (`session` BR-01); sessions opened afterwards read them, a session already open keeps its own.
- **BR-02** — The settings are the models preset `SELO_MODELS` (« Standard » `standard`, the default: opus to plan, implement and review, haiku to run and search; « Lean » `lean`: the same with sonnet to implement), one model per role `SELO_MODEL_{ROLE}` (planner, implementer, reviewer, runner, explorer: opus, sonnet, haiku or fable; absent: « Selon le preset »), `SELO_ROUTING` (`on`, else off) and `SELO_COMMIT` (`auto`, else ask), read as the selo plugin reads them: an unknown preset as « Standard ».
- **BR-03** — Saving reads the file again and changes only the settings the person changed: one set to « Standard », « Selon le preset », off or ask leaves `env`, any other is written; a role set by hand to its preset's model stays a key of its own; every other key of the file, and a setting not changed even with a value Selo Ops does not know, stays as it is, so that no hand edit and no write of Claude Code since the window opened is lost.
- **BR-04** — A missing file reads as every setting at its default, and saving creates it; a file that is not valid JSON, or whose root or `env` is not an object, is unreadable and never written.

## Non-goals

- The project and local settings files of Claude Code, which can override these keys: only the user file is shown and written.

Retired:
