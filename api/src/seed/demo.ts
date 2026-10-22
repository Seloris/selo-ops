import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "../db/client.js";
import type { ExportRun, ProjectFile, SessionFile } from "../features/sessions/sessions.export.js";
import { createSessionArchiveRepository } from "../features/sessions/sessions.repository.js";
import type { Clock } from "../shared/clock.js";

// The demo's data, inserted at each start of `npm run demo`: each feature adds the rows its browser
// tests need, through its repository, so the demo shows every screen with something on it.
// Sessions come from files: the demo writes an ops export, its times relative to the clock, to `opsDir`.

type Phase = ExportRun["phase"];

interface DemoSession {
  id: string;
  project: string;
  worktree?: string;
  lane: string;
  phase: Phase;
  age: number;
  request: string;
  blueprint?: string;
  step?: string;
  substep?: string;
  question?: string;
  commit?: { subject: string; body: string };
  error?: string;
  next?: string;
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
  { id: "3f9c2a71-5b0e-4d8a-9c1f-a2e7b6d40c13", project: "ledger-api", lane: "build", phase: "awaiting-answer", age: 95,
    request: "Solde mensuel par client : afficher le solde de chaque mois sur la fiche client, avec le détail des factures et des avoirs",
    blueprint: "2026-10-20-monthly-balance", step: "stage:1", substep: "code",
    question: "Le statut « remboursé » compte-t-il dans le solde du mois ? (A) oui, en négatif — recommandé · (B) non · (C) seulement si le remboursement est partiel",
    model: OPUS, effort: "high", perms: "auto", blockers: ["not-done", "question", "dirty-files"],
    subagents: [{ type: "selo:runner", task: "npm test -- balance", phase: "job-done" }],
    files: ["api/src/billing/balance.ts", "api/src/billing/balance.test.ts", "api/migrations/0012_monthly_balance.sql"] },
  { id: "91d0b7e3-2c4a-4f68-b5e9-7a13c8f20d54", project: "atelier-web", lane: "fastlane", phase: "awaiting-commit", age: 360,
    request: "Garder le code promo quand on revient au panier",
    commit: { subject: "feat(cart): keep promo code across sessions", body: "Spec: cart ~FR-07" },
    model: SONNET, effort: "medium", perms: "acceptEdits", blockers: ["not-done", "pending-commit", "dirty-files"],
    files: ["web/src/features/cart/data/useCartQuery.ts", "web/src/features/cart/ui/PromoField.tsx", ".planning/pages/cart.md"] },
  { id: "5a6e3d92-81bf-4c07-9e2a-d4f1b0c87e36", project: "selo-ops", lane: "free", phase: "stopped", age: 660,
    request: "Pourquoi le build du front casse depuis ce matin ?",
    error: "npm run build : TS2322 — Type « string | undefined » non assignable à « string » (web/src/features/sessions/ui/SessionRow.tsx:42)",
    model: OPUS, effort: "high", perms: "default", blockers: ["not-done", "dirty-files"],
    subagents: [{ type: "selo:runner", task: "npm run build", phase: "stopped" }],
    files: ["web/src/features/sessions/ui/SessionRow.tsx"] },
  { id: "e47c1a08-9d35-4b62-8f0e-1c5a7b93d2f4", project: "harbor-mobile", lane: "autopilot", phase: "awaiting-answer", age: 2880,
    request: "Mode hors-ligne pour la liste des tournées : consulter et cocher les arrêts sans réseau, puis synchroniser au retour du réseau",
    blueprint: "2026-10-22-offline-rounds", step: "blueprint",
    question: "Aucune réponse recommandée : cache local en lecture seule, ou file d’attente des modifications rejouée au retour du réseau ?",
    model: OPUS, effort: "xhigh", perms: "auto", blockers: ["not-done", "question"] },
  { id: "2b8f6c15-4e7d-4a91-b3c0-8d2e5f6a1b97", project: "ledger-api", lane: "fastlane", phase: "awaiting-commit", age: 4800,
    request: "Arrondi de la TVA : arrondir ligne par ligne, pas sur le total",
    commit: { subject: "fix(invoices): round VAT per line, not per total", body: "Spec: invoice ~BR-04" },
    model: SONNET, effort: "medium", perms: "acceptEdits", blockers: ["not-done", "pending-commit", "dirty-files"],
    files: ["api/src/invoices/vat.ts", "api/src/invoices/vat.test.ts", ".planning/domain/invoice.md"] },
  { id: "7c3a9e51-0f2b-4d84-a6e7-b19d4c2f8a03", project: "selo-ops", lane: "build", phase: "working", age: 4,
    request: ".planning/blueprints/2026-10-22-sessions-live.md", blueprint: "2026-10-22-sessions-live", step: "stage:2", substep: "code",
    model: OPUS, effort: "high", perms: "auto", blockers: ["not-done", "dirty-files", "background-tasks", "subagents"],
    subagents: [
      { type: "selo:runner", task: "npm run build && npx eslint src/features/sessions", phase: "working" },
      { type: "selo:reviewer", task: "relecture de l’étape 1 (api)", phase: "job-done" },
    ],
    files: ["web/src/features/sessions/pages/SessionsLivePage.tsx", "web/src/features/sessions/ui/SessionRow.tsx", "web/src/shared/lib/i18n/fr.json"] },
  { id: "b81e0c44-6a2f-4c19-8d3e-5f07a9c2e611", project: "atelier-web", worktree: "one-step-checkout", lane: "autopilot", phase: "working", age: 2,
    request: "Refaire la page de paiement en une seule étape : adresse, livraison et carte sur le même écran, validation en direct de chaque champ, et un récapitulatif fixe à droite sur grand écran",
    blueprint: "2026-10-22-one-step-checkout", step: "stage:1", substep: "tests",
    model: OPUS, effort: "high", perms: "auto", blockers: ["not-done", "dirty-files", "subagents"],
    subagents: [{ type: "selo:runner", task: "npx vitest run checkout", phase: "working" }],
    files: ["web/src/features/checkout/pages/CheckoutPage.tsx", "web/src/features/checkout/ui/AddressForm.tsx"] },
  { id: "c2d94f10-37a8-4e5b-a1c6-90e4b7d3f285", project: "harbor-mobile", lane: "review", phase: "working", age: 21,
    request: "Relire le travail d’hier sur la synchro des photos",
    model: OPUS, effort: "medium", perms: "default", blockers: ["not-done", "subagents"],
    subagents: [{ type: "selo:reviewer", task: "relecture de 4 commits", phase: "working" }] },
  { id: "0d5e8b27-6a1c-4f93-8e42-c7b0a3d9f1e6", project: "selo-ops", lane: "blueprint", phase: "turn-ended", age: 240,
    request: "Archiver une session à la main quand son travail est fini", blueprint: "2026-10-22-session-archive",
    next: "/selo:build .planning/blueprints/2026-10-22-session-archive.md",
    model: OPUS, effort: "high", perms: "default", blockers: ["not-done"],
    commits: [{ sha: "a41c9e2", subject: "docs(session-archive): blueprint — manual archive" }],
    files: [".planning/blueprints/2026-10-22-session-archive.md"] },
  { id: "6f2a4c80-b3d1-4e57-9a08-e5c2d7f13b49", project: "ledger-api", lane: "grill", phase: "turn-ended", age: 1020,
    request: "Export CSV des factures", model: SONNET, effort: "medium", perms: "default", blockers: ["not-done"] },
  { id: "a9c7e215-3f8b-4d06-b2e4-61d0f5a8c793", project: "atelier-web", lane: "fastlane", phase: "job-done", age: 540,
    request: "Le filtre par taille se vide quand on revient en arrière", model: SONNET, effort: "medium", perms: "acceptEdits", blockers: [],
    recap: "Le filtre par taille garde la sélection après un retour arrière.",
    commits: [{ sha: "c7d21f0", subject: "fix(catalog): keep size filter on back navigation" }],
    files: ["web/src/features/catalog/ui/SizeFilter.tsx", ".planning/pages/catalog.md"] },
  { id: "d3b16f74-e0a9-4c25-87d1-4f9e2b6c0a58", project: "selo-ops", lane: "free", phase: "job-done", age: 7500,
    request: "Ajouter un script npm run app:demo à la racine", model: null, effort: "low", perms: "acceptEdits", blockers: ["dirty-files"],
    recap: "Script app:demo ajouté : il lance l’API et le web en démo, sur le créneau du worktree.",
    commits: [{ sha: "9b0e4d3", subject: "tools(tooling): add app:demo script" }], files: ["package.json", "selo-run.mjs"] },
  { id: "48e0a6d1-7b2c-4f39-a5e8-0c9d3f7b2e16", project: "harbor-mobile", lane: "try", phase: "turn-ended", age: 2040,
    request: "Tester la connexion avec le compte livreur", model: SONNET, effort: "low", perms: "default", blockers: ["not-done", "background-tasks"],
    recap: "Connexion du compte livreur vérifiée ; la démo tourne encore sur le port 5191." },
  { id: "f5a2c938-1d6e-4b70-9c3f-8e4b0a7d6c21", project: "ledger-api", lane: "build", phase: "job-done", age: 1500,
    request: ".planning/blueprints/2026-10-19-payment-reminders.md", blueprint: "2026-10-19-payment-reminders",
    model: OPUS, effort: "high", perms: "auto", blockers: ["background-tasks"],
    recap: "Relances à J+15 et J+30 envoyées par la tâche du matin ; spec facture mise à jour.",
    commits: [
      { sha: "3e8a1f6", subject: "feat(payment-reminders): api — reminders job" },
      { sha: "b52c0d9", subject: "feat(payment-reminders): web — reminders on the invoice page" },
      { sha: "7f41e2a", subject: "docs(payment-reminders): spec merged" },
    ] },
  { id: "1e7b3c90-5a4d-4e82-b0f6-d2c8a9e41f37", project: "selo-ops", lane: "fastlane", phase: "job-done", age: 10800, isClosed: true,
    request: "Bouton thème clair / sombre dans l’en-tête", model: SONNET, effort: "medium", perms: "acceptEdits", blockers: [],
    recap: "Le thème se choisit dans l’en-tête et reste mémorisé.", commits: [{ sha: "4c9d2e1", subject: "feat(app): theme switch in the header" }] },
  { id: "8a4d0f62-c9e1-4b37-a2d5-6f3b8e0c7a94", project: "atelier-web", lane: "free", phase: "stopped", age: 14400, isClosed: true,
    request: "Essayer Vite 6 sur le front", error: "npm ci : ERESOLVE, impossible de résoudre la dépendance @vitejs/plugin-react",
    model: SONNET, effort: "low", perms: "default", blockers: ["not-done", "dirty-files"], files: ["web/package.json"] },
  { id: "c06f9b3e-2d7a-4e18-95c4-a8e1d3b70f52", project: "ledger-api", lane: "blueprint", phase: "stopped", age: 20000, isClosed: true,
    request: "Multi-devises sur les factures", model: OPUS, effort: "high", perms: "default", blockers: ["not-done"] },
  { id: "93b5e7a2-0c4f-4d16-8b9e-2a7d1f6c5e08", project: "selo-ops", lane: "build", phase: "job-done", age: 93000, archivedAge: 90000,
    request: ".planning/blueprints/2026-10-20-ops-export.md", blueprint: "2026-10-20-ops-export",
    model: OPUS, effort: "high", perms: "auto", blockers: [], recap: "L’API lit l’export ops et sert la liste des projets.",
    commits: [{ sha: "e1f7a30", subject: "feat(ops-export): api — read the ops export" }] },
  { id: "27d8c4f1-6b3e-4a05-9f2d-c1e0b8a5d374", project: "ledger-api", lane: "fastlane", phase: "job-done", age: 101000, archivedAge: 100000,
    request: "Corriger le tri des factures par date", model: SONNET, effort: "medium", perms: "acceptEdits", blockers: [],
    recap: "Les factures se trient par date d’émission, la plus récente d’abord.", commits: [{ sha: "5d2b8c7", subject: "fix(invoices): sort by issue date" }] },
  { id: "b4e1a8d6-9f0c-4372-a5b8-3d6e2c9f1a70", project: "harbor-mobile", lane: "fastlane", phase: "job-done", age: 182000, archivedAge: 180000,
    request: "Icône de l’app en mode sombre", model: SONNET, effort: "low", perms: "acceptEdits", blockers: [],
    recap: "Icône sombre ajoutée pour iOS et Android.", commits: [{ sha: "0a9f3e4", subject: "feat(app): dark app icon" }] },
];

const ROOT = "~/code";
const repoOf = (project: string) => `${ROOT}/${project}/.git`;
const rootOf = (s: DemoSession) => (s.worktree ? `${ROOT}/${s.project}/.claude/worktrees/${s.worktree}` : `${ROOT}/${s.project}`);
const keyOf = (root: string) => root.replace(/[^A-Za-z0-9]/g, "-");

function writeJson(dir: string, name: string, data: unknown) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2) + "\n");
}

export async function seedDemo(db: Database, clock: Clock, { opsDir }: { opsDir: string }): Promise<void> {
  const now = clock.now().getTime();
  const at = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString();

  const projectFiles: ProjectFile[] = [
    ...Object.entries(PROJECTS).map(([name, p]) => ({
      schemaVersion: 1 as const, root: `${ROOT}/${name}`, repo: repoOf(name), branch: p.branch, changedCount: p.changed, manifest: { name },
    })),
    ...SESSIONS.filter((s) => s.worktree).map((s) => ({
      schemaVersion: 1 as const, root: rootOf(s), repo: repoOf(s.project), branch: `claude/${s.worktree}`, changedCount: 2, manifest: { name: s.project },
    })),
  ];
  for (const p of projectFiles) writeJson(join(opsDir, "projects"), `${keyOf(p.root)}.json`, p);

  const archives = createSessionArchiveRepository(db);
  for (const s of SESSIONS) {
    const since = at(s.age + 600);
    const current: ExportRun = {
      id: `${s.id}:1`, agentId: null, lane: s.lane, request: s.request, task: null, blueprint: s.blueprint ?? null,
      step: s.step ?? s.lane, substep: s.substep ?? null, error: s.error ?? null, phase: s.phase,
      pendingCommit: s.commit ?? null, question: s.question ?? null,
      recap: s.recap ? { text: s.recap, commits: s.commits ?? [] } : null, commits: s.commits ?? [],
      resumePrompt: s.next ?? null, since, updatedAt: at(s.age),
    };
    const subagents: ExportRun[] = (s.subagents ?? []).map((a, i) => ({
      ...current, id: `${s.id}:agent-${i}`, agentId: `agent-${i}`, lane: "free", request: a.type, task: a.task, phase: a.phase,
      blueprint: null, pendingCommit: null, question: null, error: null, recap: null, commits: [], resumePrompt: null, since: at(s.age + 300 - i),
    }));
    const root = rootOf(s);
    const file: SessionFile = {
      schemaVersion: 1, writtenAt: at(s.age), sessionId: s.id, root, rootKey: keyOf(root), repo: repoOf(s.project),
      status: s.isClosed ? "ended" : "live", model: s.model, permissionMode: s.perms, effort: s.effort,
      touchedFiles: s.files ?? [], close: { ok: s.blockers.length === 0, blockers: s.blockers },
      runs: [...subagents, current], current,
    };
    writeJson(join(opsDir, "sessions"), `${s.id}.json`, file);
    if (s.archivedAge !== undefined) await archives.save({ sessionId: s.id, runId: current.id, archivedAt: new Date(now - s.archivedAge * 1000) });
  }
}
