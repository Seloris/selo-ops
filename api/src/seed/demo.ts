import { execFileSync } from "node:child_process";
import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { uptime } from "node:os";
import { basename, dirname, join } from "node:path";
import type { Database } from "../db/client.js";
import type { ExportRun, ExportRunUsage, ExportUsage, ProjectFileInput, SessionFile } from "../features/sessions/sessions.export.js";
import { normRoot, type RunningStatusFile } from "../features/sessions/sessions.outside.js";
import { seedPlanning } from "./demo.planning.js";
import { createDesktopSessionLinkRepository, createSessionArchiveRepository, createSessionNoteRepository } from "../features/sessions/sessions.repository.js";
import type { Clock } from "../shared/clock.js";

// The demo's data, inserted at each start of `npm run demo`: each feature adds the rows its browser
// tests need, through its repository, so the demo shows every screen with something on it.
// Sessions come from files: the demo writes an ops export, its times relative to the clock, to `opsDir`.

type Phase = ExportRun["phase"];

interface DemoSession {
  id: string;
  project: string;
  worktree?: string;
  // The run's flow, skill and mode: `iterate` for a fastlane's iterate mode, `autonomous` for an autonomous pilot (`session` BR-22).
  flow: string;
  skill?: string;
  mode?: string;
  // The current run's trail: seconds ago, skill, step, substep, phase (sessions-live FR-41).
  trail?: [number, string | null, string | null, string | null, Phase][];
  trailCut?: boolean;
  phase: Phase;
  age: number;
  request: string;
  blueprint?: string;
  step?: string;
  substep?: string;
  question?: string;
  commit?: { subject: string; body: string };
  error?: string;
  // The resume prompt, and the `Next:` lines of the done footer: summary, prompt (sessions-live FR-48).
  next?: string;
  nextSteps?: [string, string][];
  model: string | null;
  effort: string;
  perms: string;
  blockers: string[];
  subagents?: { type: string; task: string; phase: Phase }[];
  files?: string[];
  recap?: string;
  commits?: { sha: string; subject: string }[];
  isClosed?: boolean;
  archivedAge?: number;
  // The person's note on the session (`session` BR-21).
  note?: string;
  // The shell command its running process waits on a permission dialog to run (`session` BR-16), since `age`.
  permission?: string;
  // Earlier free prompts, each a main run of its own before the current one (sessions-live FR-36); null when unreadable.
  earlier?: (string | null)[];
}

const PROJECTS: Record<string, { branch: string; changed: number }> = {
  "ledger-api": { branch: "main", changed: 2 },
  "harbor-mobile": { branch: "develop", changed: 1 },
  "atelier-web": { branch: "main", changed: 0 },
  "selo-ops": { branch: "main", changed: 5 },
};

const OPUS = "claude-opus-5-5";
const SONNET = "claude-sonnet-5-5";

const SESSIONS: DemoSession[] = [
  { id: "3f9c2a71-5b0e-4d8a-9c1f-a2e7b6d40c13", project: "ledger-api", flow: "blueprint", skill: "build", phase: "awaiting-answer", age: 95,
    request: "Solde mensuel par client : afficher le solde de chaque mois sur la fiche client, avec le détail des factures et des avoirs",
    blueprint: "2026-10-20-monthly-balance", step: "stage:1", substep: "code",
    question: "Le statut « remboursé » compte-t-il dans le solde du mois ? (A) oui, en négatif — recommandé · (B) non · (C) seulement si le remboursement est partiel",
    model: OPUS, effort: "high", perms: "auto", blockers: ["not-done", "question", "dirty-files"],
    subagents: [{ type: "selo:runner", task: "npm test -- balance", phase: "job-done" }],
    files: ["api/src/billing/balance.ts", "api/src/billing/balance.test.ts", "api/migrations/0012_monthly_balance.sql"] },
  { id: "91d0b7e3-2c4a-4f68-b5e9-7a13c8f20d54", project: "atelier-web", flow: "fastlane", skill: "fastlane", phase: "awaiting-commit", age: 360,
    request: "Garder le code promo quand on revient au panier",
    commit: { subject: "feat(cart): keep promo code across sessions", body: "Spec: cart ~FR-07" },
    model: SONNET, effort: "medium", perms: "acceptEdits", blockers: ["not-done", "pending-commit", "dirty-files"],
    files: ["web/src/features/cart/data/useCartQuery.ts", "web/src/features/cart/ui/PromoField.tsx", ".planning/pages/cart.md"] },
  { id: "5a6e3d92-81bf-4c07-9e2a-d4f1b0c87e36", project: "selo-ops", flow: "free", phase: "stopped", age: 660,
    request: "Pourquoi le build du front casse depuis ce matin ?",
    error: "npm run build : TS2322 — Type « string | undefined » non assignable à « string » (web/src/features/sessions/ui/SessionRow.tsx:42)",
    model: OPUS, effort: "high", perms: "default", blockers: ["not-done", "dirty-files"],
    subagents: [{ type: "selo:runner", task: "npm run build", phase: "stopped" }],
    files: ["web/src/features/sessions/ui/SessionRow.tsx"] },
  { id: "e47c1a08-9d35-4b62-8f0e-1c5a7b93d2f4", project: "harbor-mobile", flow: "pilot", skill: "blueprint", mode: "autonomous", phase: "awaiting-answer", age: 2880,
    request: "Mode hors-ligne pour la liste des tournées : consulter et cocher les arrêts sans réseau, puis synchroniser au retour du réseau",
    blueprint: "2026-10-22-offline-rounds", step: "blueprint",
    question: "Aucune réponse recommandée : cache local en lecture seule, ou file d’attente des modifications rejouée au retour du réseau ?",
    model: OPUS, effort: "xhigh", perms: "auto", blockers: ["not-done", "question"] },
  { id: "2b8f6c15-4e7d-4a91-b3c0-8d2e5f6a1b97", project: "ledger-api", flow: "fastlane", skill: "fastlane", phase: "awaiting-commit", age: 4800,
    request: "Arrondi de la TVA : arrondir ligne par ligne, pas sur le total",
    commit: { subject: "fix(invoices): round VAT per line, not per total", body: "Spec: invoice ~BR-04" },
    model: SONNET, effort: "medium", perms: "acceptEdits", blockers: ["not-done", "pending-commit", "dirty-files"],
    files: ["api/src/invoices/vat.ts", "api/src/invoices/vat.test.ts", ".planning/domain/invoice.md"] },
  { id: "6d1f8b3a-4c27-4e95-a0b6-3e9c5d2f7a18", project: "harbor-mobile", flow: "pilot", skill: "fastlane", phase: "working", age: 240,
    request: "Purger le cache des photos de tournée au démarrage quand il dépasse 200 Mo", substep: "code",
    permission: "rm -rf android/app/build/intermediates/photo-cache && npx react-native run-android --variant=debug",
    model: OPUS, effort: "medium", perms: "default", blockers: ["not-done", "dirty-files"],
    files: ["src/features/rounds/data/photoCache.ts", "src/features/rounds/data/photoCache.test.ts"] },
  { id: "7c3a9e51-0f2b-4d84-a6e7-b19d4c2f8a03", project: "selo-ops", flow: "blueprint", skill: "build", phase: "working", age: 4, trailCut: true,
    trail: [[590, "build", "stage:1", "commit", "awaiting-commit"], [500, "build", "stage:2", "tests", "working"], [300, "build", "stage:2", "code", "working"]],
    request: ".planning/blueprints/2026-10-22-sessions-live.md", blueprint: "2026-10-22-sessions-live", step: "stage:2", substep: "code",
    model: OPUS, effort: "high", perms: "auto", blockers: ["not-done", "dirty-files", "background-tasks", "subagents"],
    subagents: [
      { type: "selo:runner", task: "npm run build && npx eslint src/features/sessions", phase: "working" },
      { type: "selo:reviewer", task: "relecture de l’étape 1 (api)", phase: "job-done" },
    ],
    files: ["web/src/features/sessions/pages/SessionsLivePage.tsx", "web/src/features/sessions/ui/SessionRow.tsx", "web/src/shared/lib/i18n/fr.json"] },
  { id: "b81e0c44-6a2f-4c19-8d3e-5f07a9c2e611", project: "atelier-web", worktree: "one-step-checkout", flow: "pilot", skill: "build", mode: "autonomous", phase: "working", age: 2,
    trail: [
      [600, "pilot", null, null, "working"], [570, "blueprint", null, null, "working"], [420, "blueprint", null, "commit", "awaiting-commit"],
      [300, "blueprint", null, null, "working"], [240, "build", "stage:1", "tests", "working"],
    ],
    request: "Refaire la page de paiement en une seule étape : adresse, livraison et carte sur le même écran, validation en direct de chaque champ, et un récapitulatif fixe à droite sur grand écran",
    blueprint: "2026-10-22-one-step-checkout", step: "stage:1", substep: "tests",
    model: OPUS, effort: "high", perms: "auto", blockers: ["not-done", "dirty-files", "subagents"],
    note: "Après : vérifier le récap fixe sur iPad, puis demander la relecture à Inès",
    subagents: [{ type: "selo:runner", task: "npx vitest run checkout", phase: "working" }],
    files: ["web/src/features/checkout/pages/CheckoutPage.tsx", "web/src/features/checkout/ui/AddressForm.tsx"] },
  { id: "c2d94f10-37a8-4e5b-a1c6-90e4b7d3f285", project: "harbor-mobile", flow: "free", skill: "review", phase: "working", age: 21,
    trail: [[620, null, null, null, "working"], [600, "review", null, null, "working"]],
    request: "Relire le travail d’hier sur la synchro des photos",
    model: OPUS, effort: "medium", perms: "default", blockers: ["not-done", "subagents"],
    subagents: [{ type: "selo:reviewer", task: "relecture de 4 commits", phase: "working" }] },
  // The mockup and iterate colours (help FR-11): a mockup iterated turn by turn, a fastlane's iterate loop (`session` BR-22).
  { id: "e4b7c1d2-8a3f-4e60-b95d-2c1f0a7e6d34", project: "atelier-web", flow: "free", skill: "mockup", phase: "awaiting-answer", age: 90,
    trail: [[1500, "mockup", null, null, "working"], [1320, "mockup", null, null, "awaiting-answer"], [1200, "mockup", null, null, "working"], [1100, "mockup", null, null, "awaiting-answer"], [400, "mockup", null, null, "working"], [90, "mockup", null, null, "awaiting-answer"]],
    request: "Une fiche produit avec la galerie à gauche et le choix de la taille toujours visible",
    question: "Autre chose, ou on valide ?",
    model: OPUS, effort: "medium", perms: "default", blockers: ["not-done", "question", "dirty-files"],
    files: [".planning/mockups/2026-10-24-product-sheet.html"] },
  { id: "5a9d3e17-c240-4b8f-a6d1-7e0b2f94c58a", project: "selo-ops", flow: "fastlane", skill: "fastlane", phase: "awaiting-answer", age: 35,
    mode: "iterate",
    trail: [[900, "fastlane", null, null, "working"], [780, "fastlane", null, "code", "awaiting-answer"], [600, "fastlane", null, "code", "working"], [35, "fastlane", null, "code", "awaiting-answer"]],
    request: "Resserrer les lignes de la liste des sessions", substep: "code",
    question: "Autre chose, ou on valide ?",
    model: OPUS, effort: "medium", perms: "acceptEdits", blockers: ["not-done", "question", "dirty-files"],
    files: ["web/src/features/sessions/ui/SessionList.module.css"] },
  { id: "0d5e8b27-6a1c-4f93-8e42-c7b0a3d9f1e6", project: "selo-ops", flow: "blueprint", skill: "blueprint", phase: "job-done", age: 240,
    request: "Archiver une session à la main quand son travail est fini", blueprint: "2026-10-22-session-archive",
    next: "/selo:build .planning/blueprints/2026-10-22-session-archive.md",
    nextSteps: [
      ["Construire les 2 étapes, de préférence dans une nouvelle session", "/selo:build .planning/blueprints/2026-10-22-session-archive.md"],
      ["Relire le blueprint avant de le construire", "/selo:review blueprint .planning/blueprints/2026-10-22-session-archive.md"],
    ],
    recap: "Blueprint de l’archivage manuel prêt : 2 étapes, api puis web.",
    model: OPUS, effort: "high", perms: "default", blockers: [],
    commits: [{ sha: "a41c9e2", subject: "docs(session-archive): blueprint — manual archive" }],
    files: [".planning/blueprints/2026-10-22-session-archive.md"] },
  { id: "6f2a4c80-b3d1-4e57-9a08-e5c2d7f13b49", project: "ledger-api", flow: "free", skill: "grill", phase: "turn-ended", age: 1020,
    request: "Export CSV des factures", model: SONNET, effort: "medium", perms: "default", blockers: ["not-done"] },
  { id: "a9c7e215-3f8b-4d06-b2e4-61d0f5a8c793", project: "atelier-web", flow: "fastlane", skill: "fastlane", phase: "job-done", age: 540,
    request: "Le filtre par taille se vide quand on revient en arrière", model: SONNET, effort: "medium", perms: "acceptEdits", blockers: [],
    recap: "Le filtre par taille garde la sélection après un retour arrière.",
    commits: [{ sha: "c7d21f0", subject: "fix(catalog): keep size filter on back navigation" }],
    files: ["web/src/features/catalog/ui/SizeFilter.tsx", ".planning/pages/catalog.md"] },
  { id: "d3b16f74-e0a9-4c25-87d1-4f9e2b6c0a58", project: "selo-ops", flow: "free", phase: "job-done", age: 7500,
    earlier: ["Pourquoi cette session n’a qu’une demande ?", null, "fait un .bat stp"],
    request: "Ajouter un script npm run app:demo à la racine", model: null, effort: "low", perms: "acceptEdits", blockers: ["dirty-files"],
    recap: "Script app:demo ajouté : il lance l’API et le web en démo, sur le créneau du worktree.",
    commits: [{ sha: "9b0e4d3", subject: "tools(tooling): add app:demo script" }], files: ["package.json", "selo-run.mjs"] },
  { id: "48e0a6d1-7b2c-4f39-a5e8-0c9d3f7b2e16", project: "harbor-mobile", flow: "free", skill: "try", phase: "turn-ended", age: 2040,
    request: "Tester la connexion avec le compte livreur", model: SONNET, effort: "low", perms: "default", blockers: ["not-done", "background-tasks"],
    recap: "Connexion du compte livreur vérifiée ; la démo tourne encore sur le port 5191." },
  { id: "f5a2c938-1d6e-4b70-9c3f-8e4b0a7d6c21", project: "ledger-api", flow: "blueprint", skill: "build", phase: "job-done", age: 1500,
    request: ".planning/blueprints/2026-10-19-payment-reminders.md", blueprint: "2026-10-19-payment-reminders",
    model: OPUS, effort: "high", perms: "auto", blockers: ["background-tasks"],
    recap: "Relances à J+15 et J+30 envoyées par la tâche du matin ; spec facture mise à jour.",
    commits: [
      { sha: "3e8a1f6", subject: "feat(payment-reminders): api — reminders job" },
      { sha: "b52c0d9", subject: "feat(payment-reminders): web — reminders on the invoice page" },
      { sha: "7f41e2a", subject: "docs(payment-reminders): spec merged" },
    ] },
  { id: "1e7b3c90-5a4d-4e82-b0f6-d2c8a9e41f37", project: "selo-ops", flow: "fastlane", skill: "fastlane", phase: "job-done", age: 10800, isClosed: true,
    request: "Bouton thème clair / sombre dans l’en-tête", model: SONNET, effort: "medium", perms: "acceptEdits", blockers: [],
    recap: "Le thème se choisit dans l’en-tête et reste mémorisé.", commits: [{ sha: "4c9d2e1", subject: "feat(app): theme switch in the header" }] },
  { id: "8a4d0f62-c9e1-4b37-a2d5-6f3b8e0c7a94", project: "atelier-web", flow: "free", phase: "stopped", age: 14400, isClosed: true,
    request: "Essayer Vite 6 sur le front", error: "npm ci : ERESOLVE, impossible de résoudre la dépendance @vitejs/plugin-react",
    model: SONNET, effort: "low", perms: "default", blockers: ["not-done", "dirty-files"], files: ["web/package.json"] },
  { id: "c06f9b3e-2d7a-4e18-95c4-a8e1d3b70f52", project: "ledger-api", flow: "blueprint", skill: "blueprint", phase: "stopped", age: 20000, isClosed: true,
    request: "Multi-devises sur les factures", model: OPUS, effort: "high", perms: "default", blockers: ["not-done"] },
  { id: "93b5e7a2-0c4f-4d16-8b9e-2a7d1f6c5e08", project: "selo-ops", flow: "blueprint", skill: "build", phase: "job-done", age: 93000, archivedAge: 90000,
    request: ".planning/blueprints/2026-10-20-ops-export.md", blueprint: "2026-10-20-ops-export",
    model: OPUS, effort: "high", perms: "auto", blockers: [], recap: "L’API lit l’export ops et sert la liste des projets.",
    commits: [{ sha: "e1f7a30", subject: "feat(ops-export): api — read the ops export" }] },
  { id: "27d8c4f1-6b3e-4a05-9f2d-c1e0b8a5d374", project: "ledger-api", flow: "fastlane", skill: "fastlane", phase: "job-done", age: 101000, archivedAge: 100000,
    request: "Corriger le tri des factures par date", model: SONNET, effort: "medium", perms: "acceptEdits", blockers: [],
    recap: "Les factures se trient par date d’émission, la plus récente d’abord.", commits: [{ sha: "5d2b8c7", subject: "fix(invoices): sort by issue date" }] },
  { id: "b4e1a8d6-9f0c-4372-a5b8-3d6e2c9f1a70", project: "harbor-mobile", flow: "fastlane", skill: "fastlane", phase: "job-done", age: 182000, archivedAge: 180000,
    request: "Icône de l’app en mode sombre", model: SONNET, effort: "low", perms: "acceptEdits", blockers: [],
    recap: "Icône sombre ajoutée pour iOS et Android.", commits: [{ sha: "0a9f3e4", subject: "feat(app): dark app icon" }] },
];

// What some sessions consumed (`session` BR-18 to BR-20); the others' files have no `usage` key, as a run before its
// first stop. `scale`: the current run's total tokens; `model`: the one its usage names (the session's
// export model may be null); `prompts`: how many the run lists, 50 being the most the export keeps; `agents`: the real
// model of each subagent, null for one stopped by Esc (no usage).
interface DemoUsage {
  scale: number;
  model: string;
  prompts: number;
  isProvisional?: boolean;
  isPartial?: boolean;
  hasUntimedPrompt?: boolean;
  agents?: (string | null)[];
}

const HAIKU = "claude-haiku-5-5";

const USAGE: Record<string, DemoUsage> = {
  "7c3a9e51-0f2b-4d84-a6e7-b19d4c2f8a03": { scale: 1_234_567, model: OPUS, prompts: 6, isProvisional: true, agents: [HAIKU, OPUS] },
  "3f9c2a71-5b0e-4d8a-9c1f-a2e7b6d40c13": { scale: 4_800_000, model: OPUS, prompts: 50, agents: [HAIKU] },
  "5a6e3d92-81bf-4c07-9e2a-d4f1b0c87e36": { scale: 2_600_000, model: OPUS, prompts: 3, isPartial: true, agents: [null] },
  "a9c7e215-3f8b-4d06-b2e4-61d0f5a8c793": { scale: 34_000, model: SONNET, prompts: 2, hasUntimedPrompt: true },
  "d3b16f74-e0a9-4c25-87d1-4f9e2b6c0a58": { scale: 999, model: SONNET, prompts: 1 },
};

const TOOLS = ["Read", "Edit", "Bash", "Grep", "advisor", "Write", "Glob"];
const SKILLS: { name: string; how: string }[] = [
  { name: "selo:build", how: "command" },
  { name: "write-api-tests", how: "tool" },
  { name: "caveman", how: "preloaded" },
  { name: "drizzle-migrations", how: "tool" },
  { name: "selo:review", how: "command" },
  { name: "artifact-design", how: "tool" },
  { name: "dataviz", how: "tool" },
];

type Tokens = ExportUsage["tokens"];
const KINDS = ["input", "cacheRead", "cacheWrite", "output"] as const;
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
const totalOf = (t: Tokens) => KINDS.reduce((n, k) => n + t[k], 0);

// The export sums every run into the session's totals, per model too.
function sumUsage(usages: ExportUsage[]): ExportUsage {
  const byModel = new Map<string, ExportUsage["byModel"][number]>();
  let tokens = tokensOf(0);
  let calls = 0;
  for (const u of usages) {
    calls += u.calls;
    tokens = plus(tokens, u.tokens);
    for (const m of u.byModel) {
      const cur = byModel.get(m.model) ?? { model: m.model, calls: 0, tokens: tokensOf(0) };
      byModel.set(m.model, { model: m.model, calls: cur.calls + m.calls, tokens: plus(cur.tokens, m.tokens) });
    }
  }
  return { calls, tokens, byModel: [...byModel.values()].sort((a, b) => totalOf(b.tokens) - totalOf(a.tokens)) };
}

// A main run's usage, its prompts sharing its calls; a run listing 50 prompts had more, its totals counting them all.
function runUsageOf(u: DemoUsage, at: (secondsAgo: number) => string, age: number): ExportRunUsage {
  const isCut = u.prompts >= 50;
  const promptCalls = 3;
  const calls = u.prompts * promptCalls + (isCut ? 40 : 0);
  const tokens = tokensOf(u.scale);
  const promptTokens = tokensOf(Math.round(u.scale / (u.prompts + (isCut ? 13 : 0))));
  const prompts = Array.from({ length: u.prompts }, (_, i) => ({
    at: u.hasUntimedPrompt && i === 0 ? null : at(age + 600 - i * Math.floor(540 / u.prompts)),
    calls: promptCalls,
    tokens: promptTokens,
  }));
  return {
    calls, tokens,
    byModel: [{ model: u.model, calls, tokens }],
    tools: TOOLS.map((name, i) => ({ name, count: Math.max(1, Math.round(calls / (i + 2))) })),
    skills: SKILLS.slice(0, u.prompts > 2 ? SKILLS.length : 2).map((s, i) => ({ ...s, count: Math.max(1, 4 - i) })),
    prompts, settled: !u.isProvisional, partial: u.isPartial ?? false,
  };
}

// An earlier main run: fewer tools than the current one, a skill and a prompt of its own (sessions-live FR-33, FR-38).
function earlierUsageOf(model: string, scale: number, prompt: string): ExportRunUsage {
  const tokens = tokensOf(scale);
  return {
    calls: 7, tokens, byModel: [{ model, calls: 7, tokens }],
    tools: [{ name: "Edit", count: 4 }, { name: "Grep", count: 2 }, { name: "Read", count: 1 }],
    skills: [{ name: "selo:fastlane", count: 1, how: "command" }], prompts: [{ at: prompt, calls: 7, tokens }], settled: true, partial: false,
  };
}

function agentUsageOf(model: string, scale: number): ExportRunUsage {
  const tokens = tokensOf(scale);
  return {
    calls: 9, tokens, byModel: [{ model, calls: 9, tokens }], tools: [{ name: "Bash", count: 6 }, { name: "Read", count: 3 }],
    skills: [], prompts: [], settled: true, partial: false,
  };
}

// Sessions outside selo (`session` BR-12): Claude Code's status files (the demo's own pid, so they count as alive) and
// transcripts. `folder`: a selo project's (joins its block), a worktree of one (through a `.git` file), a repository
// without selo, or a folder in no repository.
interface DemoOutside {
  id: string;
  folder: { project: string; worktree?: string } | { repository: string } | { scratch: string };
  status: "busy" | "waiting" | "idle";
  age: number;
  prompt: string;
  model: string;
}

const OUTSIDE: DemoOutside[] = [
  { id: "4c1e9a27-8b3d-4f60-a2d5-7e0b6c9f3a18", folder: { project: "selo-ops" }, status: "busy", age: 40,
    prompt: "Pourquoi le rafraîchissement rate parfois un changement d’état ?", model: OPUS },
  { id: "e8b2d5f0-3a7c-4e19-9d64-1f0a8c2b7e53", folder: { project: "selo-ops", worktree: "duration-chart" }, status: "waiting", age: 150,
    prompt: "Essayer un graphique des durées de tour par projet", model: SONNET },
  { id: "7a3f0c64-d29e-4b81-b5c7-08e4f1a6d2b9", folder: { repository: "weather-cli" }, status: "idle", age: 420,
    prompt: "Ajouter une option --json à la commande today", model: SONNET },
  { id: "b06d4e81-5c2a-4f37-8e9b-a3c7f2d10e64", folder: { scratch: "notes" }, status: "idle", age: 900,
    prompt: "Résume ces notes de réunion en cinq points", model: OPUS },
];

const keyOf = (root: string) => root.replace(/[^A-Za-z0-9]/g, "-");

function writeJson(dir: string, name: string, data: unknown) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2) + "\n");
}

// Sessions started in the terminal: no desktop link, « Ouvrir » copies the resume command. The others were started
// by the desktop app, their desktop id derived from their id.
const CLI_SESSIONS = new Set(["5a6e3d92-81bf-4c07-9e2a-d4f1b0c87e36", "e47c1a08-9d35-4b62-8f0e-1c5a7b93d2f4"]);

// A repository's `.git` folder, or a worktree's `.git` file leading to its own git dir in the repository's.
function writeRepository(root: string, branch: string) {
  mkdirSync(join(root, ".git"), { recursive: true });
  writeFileSync(join(root, ".git", "HEAD"), `ref: refs/heads/${branch}\n`);
}

function writeWorktree(repository: string, root: string, name: string) {
  const gitDir = join(repository, ".git", "worktrees", name);
  mkdirSync(gitDir, { recursive: true });
  mkdirSync(root, { recursive: true });
  writeFileSync(join(gitDir, "HEAD"), `ref: refs/heads/claude/${name}\n`);
  writeFileSync(join(gitDir, "commondir"), "../..\n");
  writeFileSync(join(root, ".git"), `gitdir: ${gitDir}\n`);
}

// A real repository, so the « Ajouter un script npm run app:demo » session's files show their diff:
// its commit, then an uncommitted change. Gives the real sha of each demo sha it commits; without git, a plain folder.
const DEMO_RUN_SCRIPT = `import { spawn } from "node:child_process";

const demo = process.argv.includes("--demo");
spawn("node", ["run.mjs", ...(demo ? ["--demo"] : [])], { stdio: "inherit" });
`;

function writeDiffRepository(root: string, branch: string): Map<string, string> {
  try {
    mkdirSync(root, { recursive: true });
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    git("init", "-q", "-b", branch);
    const config: [string, string][] = [["user.name", "Demo"], ["user.email", "demo@example.com"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]];
    for (const [key, value] of config) git("config", key, value);
    const commit = (subject: string, files: Record<string, string>) => {
      for (const [file, content] of Object.entries(files)) writeFileSync(join(root, file), content);
      git("add", "--", ...Object.keys(files));
      git("commit", "-q", "-m", subject);
      return git("rev-parse", "--short", "HEAD");
    };
    commit("chore(tooling): start", { "package.json": `{
  "name": "selo-ops",
  "private": true,
  "scripts": {
    "app": "node selo-run.mjs"
  }
}
` });
    const sha = commit("tools(tooling): add app:demo script", {
      "package.json": `{
  "name": "selo-ops",
  "private": true,
  "scripts": {
    "app": "node selo-run.mjs",
    "app:demo": "node selo-run.mjs --demo"
  }
}
`,
      "selo-run.mjs": DEMO_RUN_SCRIPT,
    });
    writeFileSync(join(root, "selo-run.mjs"), DEMO_RUN_SCRIPT.replace("run.mjs", "scripts/run.mjs"));
    return new Map([["9b0e4d3", sha]]);
  } catch {
    writeRepository(root, branch);
    return new Map();
  }
}

export interface DemoFolders {
  // The ops export the demo writes.
  opsDir: string;
  // Claude Code's status files and transcripts the demo writes, for the sessions outside selo.
  claudeSessionsDir: string;
  claudeProjectsDir: string;
  // Claude Code's list of installed plugins the demo writes: selo at two versions across projects.
  claudePluginsFile: string;
  // Claude Code's user settings file, never the person's: other keys beside the defaults, for the settings window to save into.
  claudeSettingsFile: string;
  // The projects' folders, real ones: a session outside selo finds its repository from its folder.
  codeDir: string;
  // A folder in no repository.
  scratchDir: string;
}

export async function seedDemo(db: Database, clock: Clock, folders: DemoFolders): Promise<void> {
  const { opsDir } = folders;
  const now = clock.now().getTime();
  const at = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString();
  const ROOT = normRoot(folders.codeDir);
  const repoOf = (project: string) => `${ROOT}/${project}/.git`;
  const rootOf = (s: DemoSession) => (s.worktree ? `${ROOT}/${s.project}/.claude/worktrees/${s.worktree}` : `${ROOT}/${s.project}`);
  for (const [name, p] of Object.entries(PROJECTS)) if (name !== "selo-ops") writeRepository(`${ROOT}/${name}`, p.branch);
  const realShas = writeDiffRepository(`${ROOT}/selo-ops`, PROJECTS["selo-ops"]?.branch ?? "main");

  // `project` BR-01: each project's planning, its worktrees' own blueprints in their folder.
  const worktreeRootOf = (project: string, name: string) => `${ROOT}/${project}/.claude/worktrees/${name}`;
  const planning = new Map(Object.keys(PROJECTS).map((name) => [name, seedPlanning(name, `${ROOT}/${name}`, (w) => worktreeRootOf(name, w), at)]));
  const projectFiles: ProjectFileInput[] = [
    ...Object.entries(PROJECTS).map(([name, p], i) => ({
      schemaVersion: 1 as const, root: `${ROOT}/${name}`, repo: repoOf(name), branch: p.branch, changedCount: p.changed, manifest: { name },
      selo: i === 1 ? "2.3.0" : "2.4.0", baseBranch: p.branch, aheadCount: null, unpushedCount: i, error: null,
      sheets: planning.get(name)?.sheets ?? [], blueprints: planning.get(name)?.blueprints ?? [], mockups: planning.get(name)?.mockups ?? [],
    })),
    ...SESSIONS.filter((s) => s.worktree).map((s) => ({
      schemaVersion: 1 as const, root: rootOf(s), repo: repoOf(s.project), branch: `claude/${s.worktree}`, changedCount: 2, manifest: { name: s.project },
      selo: "2.4.0", baseBranch: PROJECTS[s.project]?.branch ?? "main", aheadCount: 3, unpushedCount: null, error: null,
      blueprints: planning.get(s.project)?.worktrees.get(s.worktree ?? "") ?? [], mockups: planning.get(s.project)?.worktreeMockups(s.worktree ?? "") ?? [],
    })),
    // `project` BR-04: a repository with no selo planning, listed with its git counts only.
    { schemaVersion: 1 as const, root: `${ROOT}/weather-cli`, repo: repoOf("weather-cli"), branch: "main", changedCount: 1, manifest: null,
      selo: "2.4.0", baseBranch: "main", aheadCount: null, unpushedCount: 2, error: null, sheets: [], blueprints: [] },
  ];
  for (const p of projectFiles) writeJson(join(opsDir, "projects"), `${keyOf(p.root)}.json`, p);

  // `project` BR-05: atelier-web runs on slot 0, held by the demo's own process so it reads as live; its worktree's run
  // on slot 1 is stopped.
  const slotsDir = join(`${ROOT}/atelier-web`, ".git", "selo", "slots");
  const boot = Date.now() - uptime() * 1000;
  writeJson(slotsDir, "0.json", {
    slot: 0, root: `${ROOT}/atelier-web`, pid: process.pid, boot, startedAt: at(1800), stoppedAt: null,
    components: [{ name: "api", mode: "dev", url: "http://localhost:3000", pid: process.pid }, { name: "web", mode: "dev", url: "http://localhost:5173", pid: process.pid }],
  });
  writeJson(slotsDir, "1.json", {
    slot: 1, root: worktreeRootOf("atelier-web", "one-step-checkout"), pid: 1, boot, startedAt: at(7200), stoppedAt: at(5400),
    components: [{ name: "web", mode: "demo", url: "http://localhost:5191", pid: 1 }],
  });

  const archives = createSessionArchiveRepository(db);
  const notes = createSessionNoteRepository(db);
  await createDesktopSessionLinkRepository(db).saveMany(
    SESSIONS.filter((s) => !CLI_SESSIONS.has(s.id)).map((s) => ({ sessionId: s.id, desktopSessionId: `local_${s.id}` })),
  );
  for (const s of SESSIONS) {
    const since = at(s.age + 600);
    const commits = (s.commits ?? []).map((c) => ({ ...c, sha: realShas.get(c.sha) ?? c.sha }));
    const current: ExportRun = {
      id: `${s.id}:1`, agentId: null, flow: s.flow, skill: s.skill ?? null, mode: s.mode ?? null, request: s.request, task: null, blueprint: s.blueprint ?? null,
      next: (s.nextSteps ?? []).map(([text, prompt]) => ({ text, prompt })),
      trail: (s.trail ?? []).map(([ago, skill, step, substep, phase]) => ({ at: at(ago), skill, step, substep, phase })),
      ...(s.trailCut === undefined ? {} : { trailCut: s.trailCut }),
      step: s.step ?? null, substep: s.substep ?? null, error: s.error ?? null, phase: s.phase,
      pendingCommit: s.commit ?? null, question: s.question ?? null,
      recap: s.recap ? { text: s.recap, commits } : null, commits,
      resumePrompt: s.next ?? null, since, updatedAt: at(s.age),
    };
    const usage = USAGE[s.id];
    if (usage) current.usage = runUsageOf(usage, at, s.age);
    const subagents: ExportRun[] = (s.subagents ?? []).map((a, i) => {
      const agentModel = usage?.agents?.[i];
      return {
        ...current, id: `${s.id}:agent-${i}`, agentId: `agent-${i}`, flow: "free", skill: null, mode: null, next: [], request: a.type, task: a.task, phase: a.phase,
        blueprint: null, pendingCommit: null, question: null, error: null, recap: null, commits: [], resumePrompt: null, since: at(s.age + 300 - i),
        ...(usage ? { usage: agentModel ? agentUsageOf(agentModel, 180_000 - i * 70_000) : null } : {}),
      };
    });
    const earlier: ExportRun[] = (s.earlier ?? []).map((request, i, all) => ({
      ...current, id: `${s.id}:0-${i}`, request, phase: "job-done", next: [], blueprint: null, pendingCommit: null, question: null, error: null,
      recap: null, commits: [], resumePrompt: null,
      since: at(s.age + 600 + (all.length - i) * 900), updatedAt: at(s.age + 540 + (all.length - i) * 900),
      ...(usage ? { usage: earlierUsageOf(usage.model, 60_000 + i * 25_000, at(s.age + 590 + (all.length - i) * 900)) } : {}),
    }));
    const root = rootOf(s);
    const file: SessionFile = {
      schemaVersion: 1, writtenAt: at(s.age), sessionId: s.id, root, rootKey: keyOf(root), repo: repoOf(s.project),
      status: s.isClosed ? "ended" : "live", model: s.model, permissionMode: s.perms, effort: s.effort,
      touchedFiles: s.files ?? [], close: { ok: s.blockers.length === 0, blockers: s.blockers },
      runs: [...subagents, current, ...[...earlier].reverse()], current,
    };
    file.writtenBy = DEMO_SELO_OPS_VERSION;
    if (usage) file.usage = sumUsage([current, ...subagents, ...earlier].flatMap((r) => (r.usage ? [r.usage] : [])));
    writeJson(join(opsDir, "sessions"), `${s.id}.json`, file);
    if (s.permission !== undefined) seedPermissionWait(folders, file, s.permission, now - s.age * 1000);
    if (s.archivedAge !== undefined) await archives.save({ sessionId: s.id, runId: current.id, archivedAt: new Date(now - s.archivedAge * 1000) });
    if (s.note !== undefined) await notes.save({ sessionId: s.id, text: s.note, updatedAt: new Date(now - s.age * 1000) });
  }
  seedOutside(folders, ROOT, now);
  seedInstalledPlugins(folders.claudePluginsFile, ROOT);
  writeJson(dirname(folders.claudeSettingsFile), basename(folders.claudeSettingsFile), {
    model: "opus",
    permissions: { allow: ["Bash(npm test:*)"] },
    env: { CLAUDE_CODE_MAX_OUTPUT_TOKENS: "32000" },
  });
}

const DEMO_SELO_OPS_VERSION = "2.8.0";

function seedInstalledPlugins(file: string, root: string) {
  const entry = (version: string, projectPath?: string) => ({
    scope: projectPath ? "project" : "user",
    ...(projectPath ? { projectPath } : {}),
    installPath: `${root}/.plugins/${version}`,
    version,
  });
  const [first, second] = Object.keys(PROJECTS);
  writeJson(dirname(file), basename(file), {
    version: 2,
    plugins: {
      "selo@selo": [entry("2.6.0", `${root}/${first}`), entry("2.5.0", `${root}/${second}`)],
      "selo-ops@selo": [entry(DEMO_SELO_OPS_VERSION)],
    },
  });
}

// A running process of the export's session that waits on a permission dialog since `since`: its status file (the demo's
// pid, so it counts as alive) and its transcript, an answered call then the open one the dialog asks for.
function seedPermissionWait(folders: DemoFolders, file: SessionFile, command: string, since: number) {
  const status: RunningStatusFile = {
    pid: process.pid, sessionId: file.sessionId, cwd: file.root, startedAt: since - 1_800_000, entrypoint: "claude-desktop",
    hostSessionId: `local_${file.sessionId}`, name: null, status: "waiting", waitingFor: "permission prompt", statusUpdatedAt: since,
    updatedAt: since,
  };
  writeJson(folders.claudeSessionsDir, `${file.sessionId}.json`, status);
  const toolUse = (id: string, command: string) => ({
    type: "assistant", sessionId: file.sessionId,
    message: { id: `${id}:msg`, model: file.model, role: "assistant",
      content: [{ type: "tool_use", id, name: "mcp__terminal__run_in_terminal", input: { command } }] },
  });
  const lines = [
    { type: "user", uuid: `${file.sessionId}:prompt`, sessionId: file.sessionId, message: { role: "user", content: file.current?.request } },
    toolUse("toolu_status", "git status --short"),
    { type: "user", uuid: `${file.sessionId}:result`, sessionId: file.sessionId,
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_status", content: " M src/features/rounds/data/photoCache.ts" }] } },
    toolUse("toolu_purge", command),
  ];
  const transcriptDir = join(folders.claudeProjectsDir, file.rootKey);
  mkdirSync(transcriptDir, { recursive: true });
  const transcript = join(transcriptDir, `${file.sessionId}.jsonl`);
  writeFileSync(transcript, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  utimesSync(transcript, new Date(since), new Date(since));
}

function seedOutside(folders: DemoFolders, root: string, now: number) {
  for (const o of OUTSIDE) {
    let cwd: string;
    if ("project" in o.folder) {
      const main = `${root}/${o.folder.project}`;
      cwd = o.folder.worktree ? `${main}/.claude/worktrees/${o.folder.worktree}` : main;
      if (o.folder.worktree) writeWorktree(main, cwd, o.folder.worktree);
    } else if ("repository" in o.folder) {
      cwd = `${root}/${o.folder.repository}`;
      writeRepository(cwd, "main");
    } else {
      cwd = normRoot(join(folders.scratchDir, o.folder.scratch));
      mkdirSync(cwd, { recursive: true });
    }
    const updatedAt = now - o.age * 1000;
    const status: RunningStatusFile = {
      pid: process.pid, sessionId: o.id, cwd, startedAt: updatedAt - 3_600_000, entrypoint: "cli", hostSessionId: null, name: null,
      status: o.status, waitingFor: o.status === "waiting" ? "input needed" : null, statusUpdatedAt: updatedAt, updatedAt,
    };
    writeJson(folders.claudeSessionsDir, `${o.id}.json`, status);
    const lines = [
      { type: "user", uuid: `${o.id}:prompt`, sessionId: o.id, message: { role: "user", content: o.prompt } },
      { type: "assistant", sessionId: o.id, message: { id: `${o.id}:reply`, model: o.model, role: "assistant", content: [{ type: "text", text: "…" }] } },
      { type: "last-prompt", lastPrompt: o.prompt, sessionId: o.id },
    ];
    const transcriptDir = join(folders.claudeProjectsDir, keyOf(cwd));
    mkdirSync(transcriptDir, { recursive: true });
    const transcript = join(transcriptDir, `${o.id}.jsonl`);
    writeFileSync(transcript, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    utimesSync(transcript, new Date(updatedAt), new Date(updatedAt));
  }
}
