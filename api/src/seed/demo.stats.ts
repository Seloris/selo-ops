import type { ExportRun, ExportRunUsage, ExportUsage, SessionFile } from "../features/sessions/sessions.export.js";

// stats FR-03 to FR-09: finished sessions spread over four months, closed and archived so that the live list stays
// as it is: every flow, two models and a haiku subagent, one session whose oldest runs the export dropped (its totals
// beyond its runs'), and one past 90 days so that « Tout » shows weeks.

interface HistorySession {
  id: string;
  project: string;
  daysAgo: number;
  flow: string;
  mode?: string;
  model: string;
  // The main run's total tokens.
  scale: number;
  request: string;
  // A haiku subagent's total tokens.
  agent?: number;
  // What the session's totals hold beyond its runs': runs the export no longer keeps.
  dropped?: number;
}

const OPUS = "claude-opus-5-5";
const SONNET = "claude-sonnet-5-5";
const HAIKU = "claude-haiku-5-5";

const HISTORY: HistorySession[] = [
  { id: "a1000000-0000-4000-8000-000000000002", project: "harbor-mobile", daysAgo: 2, flow: "fastlane", model: SONNET, scale: 420_000, request: "Afficher le nombre d’arrêts restants dans l’en-tête de la tournée" },
  { id: "a1000000-0000-4000-8000-000000000003", project: "selo-ops", daysAgo: 3, flow: "blueprint", model: OPUS, scale: 2_100_000, agent: 300_000, request: ".planning/blueprints/2026-10-25-project-cards.md" },
  { id: "a1000000-0000-4000-8000-000000000005", project: "ledger-api", daysAgo: 5, flow: "pilot", mode: "autonomous", model: OPUS, scale: 3_400_000, agent: 450_000, request: "Relances de paiement par e-mail à J+15 et J+30" },
  { id: "a1000000-0000-4000-8000-000000000006", project: "atelier-web", daysAgo: 6, flow: "free", model: SONNET, scale: 150_000, request: "Pourquoi le panier se vide après la connexion ?" },
  { id: "a1000000-0000-4000-8000-000000000009", project: "selo-ops", daysAgo: 9, flow: "pilot", model: OPUS, scale: 1_200_000, request: "Notifications du navigateur quand une session attend" },
  { id: "a1000000-0000-4000-8000-000000000012", project: "ledger-api", daysAgo: 12, flow: "fastlane", model: SONNET, scale: 600_000, request: "Le numéro de facture saute une valeur après un avoir" },
  { id: "a1000000-0000-4000-8000-000000000018", project: "harbor-mobile", daysAgo: 18, flow: "blueprint", model: OPUS, scale: 2_800_000, agent: 260_000, request: ".planning/blueprints/2026-10-10-delivery-proof.md" },
  { id: "a1000000-0000-4000-8000-000000000025", project: "atelier-web", daysAgo: 25, flow: "fastlane", model: SONNET, scale: 380_000, request: "Agrandir les vignettes de la galerie produit" },
  { id: "a1000000-0000-4000-8000-000000000033", project: "selo-ops", daysAgo: 33, flow: "free", model: OPUS, scale: 900_000, request: "Comment l’export ops date-t-il un tour ?" },
  { id: "a1000000-0000-4000-8000-000000000041", project: "ledger-api", daysAgo: 41, flow: "blueprint", model: OPUS, scale: 1_900_000, dropped: 1_500_000, request: ".planning/blueprints/2026-09-15-credit-notes.md" },
  { id: "a1000000-0000-4000-8000-000000000055", project: "harbor-mobile", daysAgo: 55, flow: "pilot", mode: "autonomous", model: OPUS, scale: 2_200_000, agent: 200_000, request: "Signature du client à la livraison" },
  { id: "a1000000-0000-4000-8000-000000000070", project: "atelier-web", daysAgo: 70, flow: "free", model: SONNET, scale: 250_000, request: "Mettre à jour React Router" },
  { id: "a1000000-0000-4000-8000-000000000084", project: "selo-ops", daysAgo: 84, flow: "fastlane", model: SONNET, scale: 500_000, request: "Copier la commande de reprise d’un clic" },
  { id: "a1000000-0000-4000-8000-000000000118", project: "ledger-api", daysAgo: 118, flow: "blueprint", model: OPUS, scale: 1_600_000, request: ".planning/blueprints/2026-07-01-invoices.md" },
];

type Tokens = ExportUsage["tokens"];
// Cache reads dominate a long run, as in a real transcript.
const tokensOf = (total: number): Tokens => {
  const input = Math.round(total * 0.01);
  const cacheWrite = Math.round(total * 0.09);
  const output = Math.round(total * 0.04);
  return { input, cacheRead: total - input - cacheWrite - output, cacheWrite, output };
};

const plus = (a: Tokens, b: Tokens): Tokens => ({
  input: a.input + b.input, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite, output: a.output + b.output,
});

const usageOf = (model: string, scale: number, at: string): ExportRunUsage => {
  const tokens = tokensOf(scale);
  const calls = Math.max(3, Math.round(scale / 40_000));
  return {
    calls, tokens, byModel: [{ model, calls, tokens }], tools: [{ name: "Read", count: calls }], skills: [],
    prompts: [{ at, calls, tokens }], settled: true, partial: false,
  };
};

export interface HistoryFile {
  file: SessionFile;
  // The run an archive covers (`session` BR-09).
  runId: string;
  archivedAt: Date;
}

export function historySessions({ now, rootOf, repoOf, writtenBy }: { now: number; rootOf: (project: string) => string; repoOf: (project: string) => string; writtenBy: string }): HistoryFile[] {
  return HISTORY.map((h) => {
    const start = now - h.daysAgo * 86_400_000 - 3 * 3_600_000;
    const at = (minutes: number) => new Date(start + minutes * 60_000).toISOString();
    const usage = usageOf(h.model, h.scale, at(1));
    const current: ExportRun = {
      id: `${h.id}:1`, agentId: null, flow: h.flow, skill: h.flow === "free" ? null : h.flow, mode: h.mode ?? null, next: [], trail: [],
      request: h.request, task: null, blueprint: null, step: null, substep: null, error: null, phase: "job-done", pendingCommit: null,
      question: null, recap: null, commits: [], resumePrompt: null, usage, since: at(0), updatedAt: at(45),
    };
    const agents: ExportRun[] = h.agent === undefined ? [] : [{
      ...current, id: `${h.id}:agent`, agentId: "agent-0", flow: "free", skill: null, mode: null, request: "selo-flow:runner", task: "npx vitest run",
      usage: usageOf(HAIKU, h.agent, at(20)), since: at(20), updatedAt: at(25),
    }];
    const runs = [...agents, current];
    const sum = runs.reduce<ExportUsage>((u, r) => {
      const ru = r.usage;
      if (!ru) return u;
      const byModel = [...u.byModel];
      for (const m of ru.byModel) {
        const i = byModel.findIndex((x) => x.model === m.model);
        const prev = byModel[i];
        if (prev === undefined) byModel.push(m);
        else byModel[i] = { model: m.model, calls: prev.calls + m.calls, tokens: plus(prev.tokens, m.tokens) };
      }
      return { calls: u.calls + ru.calls, tokens: plus(u.tokens, ru.tokens), byModel };
    }, { calls: 0, tokens: tokensOf(0), byModel: [] });
    const dropped = h.dropped === undefined ? null : usageOf(h.model, h.dropped, at(0));
    const total: ExportUsage = dropped
      ? { calls: sum.calls + dropped.calls, tokens: plus(sum.tokens, dropped.tokens), byModel: sum.byModel.map((m) => (m.model === h.model ? { model: m.model, calls: m.calls + dropped.calls, tokens: plus(m.tokens, dropped.tokens) } : m)) }
      : sum;
    const root = rootOf(h.project);
    return {
      file: {
        schemaVersion: 1, writtenAt: at(45), writtenBy, sessionId: h.id, root, rootKey: root.replace(/[^A-Za-z0-9]/g, "-"), repo: repoOf(h.project),
        status: "ended", model: h.model, permissionMode: "auto", effort: "high", touchedFiles: [], close: { ok: true, blockers: [] },
        runs, current, usage: total,
      },
      runId: current.id,
      archivedAt: new Date(start + 50 * 60_000),
    };
  });
}
