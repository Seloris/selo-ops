# Question

What holds for a question asked of a project on every page: its terms and its rules. Pages cite these `BR` ids, never restate them.

## Glossary

| Business term | Identifier | Business meaning |
|---|---|---|
| `question` | `Question` | A question asked of one project, about one of its files or the whole project, and the answer a headless Claude Code run gives it. |
| `préréglage` | `preset` | A ready-made question on a file: « Explique-moi vite » or « Résume ». |
| `cible` | `target` | What a question is about: a blueprint, a page spec, a domain sheet, or the whole project. |

## Business rules

- **BR-01** — A question is asked of one project, about one of its blueprints, page specs or domain sheets, or about the whole project; Selo Ops answers it with a Claude Code run that takes no input from anyone (headless), in the checkout holding its file (`project` BR-01; the base checkout for the whole project), on the model Sonnet, so that the person gets an analysis without opening a session.
- **BR-02** — The run only reads: it may read and search the project's files, never writes one, runs no command and loads no hook nor plugin, so that it is no selo session and leaves the project as it found it.
- **BR-03** — A question on a file is a preset, « Explique-moi vite » (what the file says and why, briefly, in plain words) or « Résume » (its summary in a few points), or a free text; a question on the whole project is a free text; a free text is trimmed and holds 1 to 2000 characters; the answer is written in French.
- **BR-04** — A question is « En cours » while its run works, then « Répondu » with its answer, its model and its duration, or « Échec » with its reason: a run longer than 5 minutes is stopped, and a run cut by Selo Ops stopping reads « Interrompue » once Selo Ops starts again.
- **BR-05** — At most 3 runs work at once, all projects together; a fourth question is refused and nothing is kept.
- **BR-06** — Questions and their answers are Selo Ops' own data (`session` BR-01), kept per project and per file until the person deletes one, even once the file is gone; deleting a question « En cours » stops its run.

## Non-goals

- A conversation: one question gets one answer, with no follow-up and no answer shown while it is written.
- Choosing the model: Sonnet for every question.

Retired:
