# selo 2.2 — what Selo Ops must add to its UI

Recap of the plugins' release 2.2.0 (webapp-factory commit `53fc1fd`, 2026-10-22), written as the input of a Selo Ops blueprint: `/selo-flow:blueprint` on this file. Sources: `webapp-factory/docs/revamp-2.2.0/proposal.md` (§4, §9) and `webapp-factory/docs/revamp-2.0.0/ops-export.md` (§5.1 types, §5.6 usage, §6 row "Tokens").

The plugins are released locally, not pushed and not installed yet. Selo Ops sees the new fields only after `claude plugin update selo-feed@selo --scope user` and a new Claude Code session; sessions already running keep 1.0.0's hooks.

## 1. What changed in the plugins

| Plugin | Version | Change | Visible to Selo Ops |
|---|---|---|---|
| `selo-ops` | 1.0.0 → 2.2.0 | Each run carries `usage`: tokens per kind, per model and per prompt, tools called, skills loaded. The session carries its totals. | Yes: new fields of the session file. |
| `selo-ops` | 2.2.0 | Fix: a background subagent's end (`<task-notification>`) or a subagent's hand-back no longer opens an empty `free` run. | Yes: no new « Demande non lisible dans l'export » runs. |
| `selo` | 2.1.0 → 2.2.0 | A `PreToolUse` hook puts selo's subagents (`reviewer`, `runner`; `Explore`, `Plan` when the call names no model) on their role's model from `selo.yaml`. | Indirectly: a subagent run's real model, read from `usage.byModel`, now matches the manifest. |

The project file's header field `selo` (the writer's version) reads `2.2.0`.

## 2. The new fields (forward-only, `schemaVersion` stays 1)

```ts
type Tokens = { input: number; cacheRead: number; cacheWrite: number; output: number }

type Usage = {
  calls: number                 // API calls, deduplicated by message id
  tokens: Tokens
  byModel: { model: string; calls: number; tokens: Tokens }[]  // most tokens first
}

type RunUsage = Usage & {
  tools:   { name: string; count: number }[]                    // most first; the advisor as `advisor`
  skills:  { name: string; count: number; how: 'tool' | 'command' | 'preloaded' }[]  // name without leading slash
  prompts: { at: string | null; calls: number; tokens: Tokens }[]  // main runs only, latest 50, oldest first; [] for a subagent run
  settled: boolean              // false while read at a Stop (last message may be missing)
  partial: boolean              // true when the slice was over 32 MB: figures cover its last 32 MB
}

// Run (main or subagent):
usage: RunUsage | null          // null until the first Stop / SubagentStop; stays null for a subagent stopped by Esc
transcriptFrom: number | null   // internal to the export: Selo Ops does not read it

// SeloSession:
usage: Usage | null             // every run summed, subagents included, runs dropped past 100 included
```

Facts the UI can rely on:

- `byModel` sums to the totals, except calls with no model (counted in the totals only).
- A subagent run's real model is `usage.byModel[0].model`. The model the lead asked for is not exported.
- Built-in commands (`/compact`, `/model`, `/clear`…), Esc markers, task notifications and subagent hand-backs are neither prompts nor skills.
- A session file written by 1.0.0 has no `usage` key at all (absent, not null).
- No cost in money, no weighted estimate: raw token counts only. No per-call durations, no plan windows (5 h, 7 d).

## 3. What to add in the UI

Each item names the spec it extends. Ids are proposals; the blueprint picks them.

### 3.1 `domain/session.md`

- **Glossary**: `consommation` / `usage` (what a run or the session consumed: API calls and tokens by kind), `tokens` / `Tokens` (`input`, `cacheRead`, `cacheWrite`, `output`; business terms to choose, e.g. « Entrée », « Cache lu », « Cache écrit », « Sortie »), `modèle réel` (the model a subagent ran on).
- **New BR — usage source**: a session's and a run's usage are read from the export only (BR-01 unchanged: Selo Ops never counts tokens itself); a session outside selo (BR-12) and a 1.0.0 session have none and show « — ».
- **New BR — provisional figures**: a run with `settled: false` shows its figures as provisional (they may grow once the next prompt settles them); `partial: true` shows them as covering the last 32 MB only.
- **BR change — model**: the session's model (FR-13, FR-19) falls back to the latest run's `usage.byModel[0].model` when the export's `model` is null (it is null before the first `Stop`).

### 3.2 `pages/sessions-live.md` — Detail (FR-18 to FR-31)

- **Session totals** (new section of the detail): calls, the four token kinds, and the split per model (one row per `byModel` entry, its calls and tokens). « — » when `usage` is absent or null.
- **Per run** (where FR-19 shows the recap and commits of a finished run, and the current run): its tokens, its models (`byModel`), its tools (`tools`, top N with counts, the advisor included) and its skills (`skills`, with how each was loaded: tool, typed command, preloaded by an agent).
- **Per prompt** (inside a main run): one line per `prompts` entry: time (`at`, « — » when null), calls, tokens. Note when the run had more than 50 prompts (only the latest 50 are kept; the run's totals stay exact).
- **Subagents** (FR-19 lists type, task, state): add the real model (`usage.byModel[0].model`) and the subagent's tokens. A subagent stopped by Esc has no usage: « — ».
- **Provisional / partial markers**: a discreet tag on a run whose `settled` is false (« provisoire ») and on one whose `partial` is true (« partiel : 32 derniers Mo »).
- **FR-31** applies: the new sections fold like the others.

### 3.3 `pages/sessions-live.md` — List and cards (optional, to decide in the grill)

- **Card (FR-13)**: the session's total tokens next to the model.
- **Row (FR-11)**: no change proposed; a 36 px row has no room. Grill question: show a total tokens column, or keep it to the card and the detail?
- **Model fallback** (FR-13, FR-19): uses the new BR of §3.1.

### 3.4 FR-24 « Demande non lisible dans l'export »

Stays: sessions written by 1.0.0 keep their empty runs. New sessions no longer get them from a background subagent's end or a hand-back. No UI change; optionally note in the spec that the case is now legacy.

### 3.5 API side (`api/`)

- Read `usage` on the session and on each run (main and subagent) from the session file, `null` when absent; ignore `transcriptFrom`.
- Expose them in the session detail contract (OpenAPI handoff), typed as §2. Absent and null both map to `null` in the contract; the web shows « — ».
- Model fallback of §3.1 computed in the API, so list, card and detail agree.

## 4. Open questions for the grill

1. French labels of the four token kinds, and whether to show cache tokens apart or as « dont cache ».
2. Number format: exact counts or abbreviated (« 1,2 M »)?
3. Tokens in the list row or the card, or only in the detail?
4. How many tools and skills per run before « + N autres »?
5. Show `prompts` folded by default (a long autopilot run has up to 50)?

## 5. Out of scope (settled 2026-10-22, plugin side)

Plan windows (5 h, 7 d), the live "now / doing" line, a cost in money, per-call durations, compliance score, per-developer model choices: none is in the export.
