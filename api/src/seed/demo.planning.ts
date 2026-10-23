import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExportBlueprint, ExportSheet } from "../features/sessions/sessions.export.js";

// The demo's `.planning` folders and the export's view of them (the projects page, `project` BR-01 to BR-04): every
// blueprint state, a blueprint only a worktree holds, ideas and technical debt. Each file is written once, from the same
// data the export's lists are built from, so a panel's text agrees with its counts.

interface DemoSheet {
  kind: ExportSheet["kind"];
  slug: string;
  title: string;
  route?: string;
  intro: string;
  frs?: string[];
  brs?: string[];
  // A page stub: `Status: to bootstrap` under its route, nothing else.
  isStub?: boolean;
  // The last commit that touched it: its subject and how long ago, in seconds.
  commit: [string, number];
}

interface DemoBlueprint {
  name: string;
  title: string;
  state: ExportBlueprint["state"];
  pages: string[];
  domain: string[];
  components: string[];
  // Each stage: its component, its summary, and the short hash of its commit once committed.
  stages: [string, string, string | null][];
  delta: [string, "+" | "~" | "-", string, string][];
  decisions: string[];
  // The worktree that alone holds it.
  worktree?: string;
}

interface DemoPlanning {
  sheets: DemoSheet[];
  blueprints: DemoBlueprint[];
  ideas: [string, string][];
  debts: string[];
}

const MINUTE = 60;
const HOUR = 3600;
const DAY = 24 * HOUR;

export const DEMO_PLANNING: Record<string, DemoPlanning> = {
  "ledger-api": {
    sheets: [
      { kind: "app", slug: "app", title: "App", intro: "The shell of Ledger: its header, its sign-in, its errors.",
        frs: ["Every page shows the header with the company's name and the month being closed.", "A signed-out person lands on the sign-in page."],
        commit: ["feat(app): month in the header", 3 * DAY] },
      { kind: "page", slug: "invoices", title: "Invoices", route: "/invoices", intro: "The accountant's list of the month's invoices.",
        frs: ["The page lists the month's invoices, newest first, with their customer, amount and state.", "A search field filters the list by customer or number.",
          "« Exporter » downloads the filtered list as a CSV file (`invoice` BR-03).", "A late invoice wears a rose « En retard » tag.",
          "A click on an invoice opens its detail beside the list."],
        commit: ["feat(invoices): export the filtered list", 5 * HOUR] },
      { kind: "page", slug: "balance", title: "Monthly balance", route: "/balance", intro: "The month's balance, account by account.",
        frs: ["The page shows one row per account: opening balance, debits, credits and closing balance."],
        commit: ["docs(balance): bootstrap spec", 2 * DAY] },
      { kind: "domain", slug: "invoice", title: "Invoice", intro: "What holds for an invoice on every page.",
        brs: ["An invoice's number is unique per company and never reused.", "An invoice is late once its due date has passed and it is not paid.",
          "An export holds the invoices the list shows, in its order.", "VAT is rounded per line, to the cent, half up."],
        commit: ["fix(invoice): VAT rounded per line", 80 * MINUTE] },
    ],
    blueprints: [
      { name: "2026-10-20-monthly-balance", title: "Monthly balance per account", state: "building", pages: ["balance"], domain: ["invoice"], components: ["api", "web"],
        stages: [["api", "balance per account read from the ledger", "4be19c0"], ["web", "Balance page", null]],
        delta: [["balance", "+", "FR-02", "A month chosen in the header recomputes the balance."], ["balance", "+", "FR-03", "An account whose closing balance is negative wears a rose figure."],
          ["invoice", "~", "BR-02", "« … its due date has passed … » → « … its due date has passed by a full day … »"]],
        decisions: ["Month → the header's month (one place to choose it)", "Negative balance → rose figure, no icon (the figure says it)"] },
      { name: "2026-10-21-invoice-export", title: "Invoice export as CSV", state: "review", pages: ["invoices"], domain: ["invoice"], components: ["api", "web"],
        stages: [["api", "CSV export of the filtered list", "c7d2a19"], ["web", "« Exporter » button", "e03f5b8"]],
        delta: [["invoices", "+", "FR-03", "« Exporter » downloads the filtered list as a CSV file (`invoice` BR-03)."], ["invoice", "+", "BR-03", "An export holds the invoices the list shows, in its order."]],
        decisions: ["Format → CSV with a semicolon (Excel in French opens it)"] },
      { name: "2026-10-19-payment-reminders", title: "Payment reminders by email", state: "done", pages: ["invoices"], domain: ["invoice"], components: ["api"],
        stages: [["api", "reminder emails for late invoices", "77a0e1d"]],
        delta: [["invoices", "+", "FR-04", "A late invoice wears a rose « En retard » tag."], ["invoice", "+", "BR-02", "An invoice is late once its due date has passed and it is not paid."]],
        decisions: ["Reminder → once a week, Monday 9:00 (the accountant asked)"] },
      { name: "2026-09-02-home", title: "Home page: invoices list", state: "legacy", pages: [], domain: [], components: [], stages: [], delta: [], decisions: [] },
      { name: "2026-08-28-sign-in", title: "Sign-in with the company's account", state: "legacy", pages: [], domain: [], components: [], stages: [], delta: [], decisions: [] },
    ],
    ideas: [["invoices", "**Bulk reminder:** send a reminder to every late customer at once."], ["app", "**Dark theme:** a dark theme for late evenings."]],
    debts: ["**VAT rates hard-coded (api):** the VAT rates live in the code, not in a table. See [vat.ts](../api/src/invoices/vat.ts)."],
  },
  "harbor-mobile": {
    sheets: [
      { kind: "app", slug: "app", title: "App", intro: "The shell of Harbor: tabs, offline banner, sign-in.", frs: ["The tabs « Tournées », « Photos », « Profil » sit at the bottom."], commit: ["feat(app): bottom tabs", 9 * DAY] },
      { kind: "page", slug: "rounds", title: "Rounds", route: "/rounds", intro: "The inspector's rounds of the day.",
        frs: ["The page lists the day's rounds in their planned order.", "A round done shows a green tick.", "A round opens its checklist."], commit: ["feat(rounds): planned order", 26 * HOUR] },
      { kind: "page", slug: "photos", title: "Photos", route: "/photos", intro: "The photos taken during rounds.", frs: ["Photos are grouped by round, newest first.", "A photo not sent yet wears « En attente »."], commit: ["feat(photos): pending tag", 4 * DAY] },
    ],
    blueprints: [
      { name: "2026-10-22-offline-rounds", title: "Rounds that work offline", state: "draft", pages: ["rounds"], domain: [], components: ["mobile", "api"],
        stages: [["api", "rounds bundle for a day", null], ["mobile", "rounds cached on the device", null]],
        delta: [["rounds", "+", "FR-04", "The day's rounds stay readable without network."]], decisions: ["Cache → the day's rounds only (storage on old phones)"] },
      { name: "2026-10-18-photo-cache", title: "Photo cache purge", state: "merging", pages: ["photos"], domain: [], components: ["mobile"],
        stages: [["mobile", "cache purged over 200 MB", "5e8c2d1"]],
        delta: [["photos", "+", "FR-03", "At start, the photo cache is purged down to 200 MB, oldest sent photos first."]], decisions: ["Limit → 200 MB (the smallest phone in use)"] },
    ],
    ideas: [],
    debts: [],
  },
  "atelier-web": {
    sheets: [
      { kind: "page", slug: "catalog", title: "Catalog", route: "/", intro: "The shop's catalog.", frs: ["Products show in a grid with their price.", "A size filter narrows the grid."], commit: ["feat(catalog): size filter", 9 * MINUTE] },
      { kind: "page", slug: "cart", title: "Cart", route: "/cart", intro: "The customer's cart.", frs: ["The cart lists its lines with their quantity.", "A promo code field applies a discount."], commit: ["feat(cart): promo code", 6 * MINUTE] },
      { kind: "page", slug: "account", title: "Account", route: "/account", intro: "", isStub: true, commit: ["chore: set up selo", 3 * DAY] },
    ],
    blueprints: [
      { name: "2026-10-22-one-step-checkout", title: "One-step checkout", state: "building", pages: ["cart"], domain: [], components: ["api", "web"], worktree: "one-step-checkout",
        stages: [["api", "order placed from the cart in one call", null], ["web", "checkout on the cart page", null]],
        delta: [["cart", "+", "FR-03", "« Commander » places the order from the cart, address and payment on the same page."]], decisions: ["Payment → card only at first (the shop asked)"] },
      { name: "2026-10-15-catalog", title: "Catalog grid", state: "done", pages: ["catalog"], domain: [], components: ["web"],
        stages: [["web", "catalog grid", "2c9e7a4"]], delta: [["catalog", "+", "FR-01", "Products show in a grid with their price."]], decisions: [] },
    ],
    ideas: [["catalog", "**Wishlist:** keep products for later."]],
    debts: ["**No image sizes (web):** product images load at full size in the grid. See [ProductCard.tsx](../web/src/features/catalog/ui/ProductCard.tsx)."],
  },
  "selo-ops": {
    sheets: [
      { kind: "app", slug: "app", title: "App", intro: "The shell of Selo Ops.", frs: ["The home address opens « Sessions live ».", "The header offers a Clair / Sombre switch.", "Every page shows the same header and its tabs."], commit: ["feat(app): header tabs", 2 * DAY] },
      { kind: "page", slug: "sessions-live", title: "Sessions live", route: "/", intro: "The developer's sessions, live.",
        frs: ["The page lists the open sessions grouped by project.", "A session waiting on the person sits at the top.", "A click opens the session's detail beside the list.", "The list refreshes every 5 s."],
        commit: ["feat(sessions-live): web — detail panel", 4 * MINUTE] },
      { kind: "domain", slug: "session", title: "Session", intro: "What holds for a session on every page.",
        brs: ["Selo Ops reads the ops export and never writes to it.", "A session's state is its current run's phase.", "A session is closed once the export marks it ended."], commit: ["docs(session): spec merged", 3 * DAY] },
    ],
    blueprints: [
      { name: "2026-10-22-sessions-live", title: "Sessions live: list and detail", state: "building", pages: ["sessions-live"], domain: ["session"], components: ["api", "web"],
        stages: [["api", "sessions read from the export", "9d4b2e7"], ["web", "Sessions live page", null]],
        delta: [["sessions-live", "+", "FR-05", "The detail shows the session's request, state and next action."], ["sessions-live", "~", "FR-04", "« The list refreshes every 5 s. » → « The list refreshes every 5 s and says when. »"],
          ["session", "-", "BR-03", "« A session is closed once the export marks it ended. »"]],
        decisions: ["Refresh → poll every 5 s (no push from the export)", "Detail → a side panel (the list stays in sight)"] },
      { name: "2026-10-22-session-archive", title: "Archive a session by hand", state: "ready", pages: ["sessions-live"], domain: ["session"], components: ["api", "web"],
        stages: [["api", "archive and unarchive a session", null], ["web", "« Archiver » in the detail", null]],
        delta: [["session", "+", "BR-04", "An archive is kept until the person unarchives the session."]], decisions: ["Confirm → only when the session still works (no click lost)"] },
      { name: "2026-10-20-ops-export", title: "Read the ops export", state: "done", pages: [], domain: ["session"], components: ["api"],
        stages: [["api", "read the ops export", "e1f7a30"]], delta: [["session", "+", "BR-01", "Selo Ops reads the ops export and never writes to it."]], decisions: [] },
    ],
    ideas: [["sessions-live", "**Session token count:** see the number of tokens a session used."], ["sessions-live", "**Session duration:** see when a session was created and how long it ran."], ["app", "**Terminal mode:** drive sessions from a terminal in the app."]],
    debts: ["**Export read on each poll (api):** the whole export is read again every 5 s. See [sessions.export.ts](../api/src/features/sessions/sessions.export.ts).", "**Panel width in local storage (web):** the detail's width is kept per browser only. See [panelWidth.ts](../web/src/features/sessions/ui/panelWidth.ts)."],
  },
};

const id = (prefix: string, i: number) => `${prefix}-${String(i + 1).padStart(2, "0")}`;
const scopeOf = (name: string) => name.replace(/^\d{4}-\d{2}-\d{2}-/, "");
const commitOf = (b: DemoBlueprint, [component, summary]: [string, string, string | null]) => `feat(${scopeOf(b.name)}): ${component} — ${summary}`;
const sheetFile = (s: DemoSheet) => (s.kind === "page" ? `.planning/pages/${s.slug}.md` : `.planning/domain/${s.slug}.md`);
const blueprintFile = (b: DemoBlueprint) => `.planning/blueprints/${b.name}.md`;
// A short hash that looks like git's, the same for the same subject.
const shaOf = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(7, "0").slice(0, 7);

function sheetText(s: DemoSheet): string {
  if (s.isStub) return `# ${s.title}\n\nRoute: \`${s.route ?? ""}\`\nStatus: to bootstrap\n`;
  const frs = (s.frs ?? []).map((t, i) => `- **${id("FR", i)}** — ${t}`);
  const brs = (s.brs ?? []).map((t, i) => `- **${id("BR", i)}** — ${t}`);
  return [
    `# ${s.title}`,
    "",
    ...(s.route ? [`Route: \`${s.route}\``, ""] : []),
    s.intro,
    "",
    ...(brs.length ? ["## Business rules", "", ...brs, ""] : []),
    ...(frs.length ? [s.kind === "page" ? "## The page" : "## Functional requirements", "", ...frs, ""] : []),
    "Retired:",
    "",
  ].join("\n");
}

function blueprintText(b: DemoBlueprint): string {
  if (b.state === "legacy") return `# ${b.title}\n\nLegacy: a 1.0 plan moved by \`/selo:setup update\`.\n\n## Plan\n\n- The list of invoices, newest first.\n`;
  const allDone = b.stages.every(([, , sha]) => sha !== null);
  const reviewDone = b.state === "merging" || b.state === "done";
  const header = [`Pages: ${b.pages.map((p) => `\`${p}\``).join(", ") || "—"}`, `Domain: ${b.domain.map((d) => `\`${d}\``).join(", ") || "—"}`, `Components: ${b.components.map((c) => `\`${c}\``).join(", ")}`].join(" · ");
  return [
    `# ${b.title}`,
    "",
    header,
    "",
    "## Spec delta",
    ...b.delta.map(([sheet, op, i, text]) => `- ${sheet} ${op} ${i} — ${text}`),
    "",
    "## Business decisions",
    ...b.decisions.map((d) => `- ${d}`),
    "",
    "## Technical defaults",
    "- Contract → one route per action, problem details on errors",
    "",
    "## Stages",
    ...b.stages.map((st, i) => `${i + 1}. ${st[0]} — \`${commitOf(b, st)}\``),
    "",
    "## Tests",
    ...b.components.map((c) => `- ${c}: the rules of the delta, one test each`),
    "",
    "## Progress",
    ...b.stages.map(([component, , sha], i) => `- [${sha ? "x" : " "}] Stage ${i + 1} — ${component}`),
    `- [${reviewDone ? "x" : " "}] Review`,
    `- [${reviewDone && allDone ? "x" : " "}] Browser test`,
    `- [${b.state === "done" ? "x" : " "}] Spec merged`,
    "",
  ].join("\n");
}

function write(root: string, path: string, text: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

const toExportBlueprint = (b: DemoBlueprint, at: (secondsAgo: number) => string): ExportBlueprint => {
  const file = blueprintFile(b);
  const isOpen = b.state !== "done" && b.state !== "legacy";
  return {
    name: b.name,
    file,
    title: b.title,
    sheets: [...b.pages, ...b.domain],
    components: b.components,
    state: b.state,
    delta: b.delta.map(([sheet, op, i, text]) => ({ sheet, op, id: i, text })),
    decisions: b.decisions,
    stages: b.state === "legacy" ? [] : b.stages.map((st, i) => ({ number: i + 1, component: st[0], commit: commitOf(b, st), sha: st[2], done: st[2] !== null })),
    progress: { reviewDone: b.state === "merging" || b.state === "done", specMerged: b.state === "done" },
    next: isOpen && b.state !== "draft" ? { prompt: `/selo:${b.state === "review" ? "review" : "build"} ${file}` } : null,
    sessions: [],
    modifiedAt: at(6 * HOUR),
  };
};

// Writes the project's `.planning` (and its worktrees' blueprints) and returns the export's lists for the base checkout
// and for each worktree, by worktree name.
export function seedPlanning(project: string, root: string, worktreeRoot: (name: string) => string, at: (secondsAgo: number) => string) {
  const planning = DEMO_PLANNING[project];
  if (planning === undefined) return null;
  const isOpen = (b: DemoBlueprint) => b.state !== "done" && b.state !== "legacy";
  const touches = (b: DemoBlueprint, slug: string) => b.pages.includes(slug) || b.domain.includes(slug) || b.delta.some(([sheet]) => sheet === slug);
  const sheets: ExportSheet[] = planning.sheets.map((s) => {
    write(root, sheetFile(s), sheetText(s));
    const frCount = s.frs?.length ?? 0;
    const brCount = s.brs?.length ?? 0;
    return {
      kind: s.kind, slug: s.slug, component: null, file: sheetFile(s), title: s.title, route: s.route ?? null,
      ids: { fr: frCount, br: brCount, next: { fr: id("FR", frCount), br: id("BR", brCount) } },
      lastCommit: { sha: shaOf(s.commit[0]), subject: s.commit[0], at: at(s.commit[1]) },
      openBlueprints: planning.blueprints.filter((b) => isOpen(b) && !b.worktree && touches(b, s.slug)).map((b) => b.name),
    };
  });
  const base = planning.blueprints.filter((b) => !b.worktree);
  for (const b of base) write(root, blueprintFile(b), blueprintText(b));
  const worktrees = new Map<string, ExportBlueprint[]>();
  for (const b of planning.blueprints.filter((x) => x.worktree)) {
    const name = b.worktree ?? "";
    write(worktreeRoot(name), blueprintFile(b), blueprintText(b));
    // A worktree holds the base's blueprints too, as of its branch.
    worktrees.set(name, [...(worktrees.get(name) ?? base.map((x) => toExportBlueprint(x, at))), toExportBlueprint(b, at)]);
  }
  write(root, ".planning/ideas.md", ["# Ideas", "", "The person's ideas, not yet specified.", "",
    ...[...new Set(planning.ideas.map(([scope]) => scope))].flatMap((scope) => [`## ${scope}`, "", ...planning.ideas.filter(([s]) => s === scope).map(([, text]) => `- 2026-10-20 — ${text}`), ""])].join("\n"));
  write(root, ".planning/technical-debt.md", ["# Technical debt", "", "A flat list, new items at the bottom.", "", ...planning.debts.map((d) => `- ${d}`), ""].join("\n"));
  return { sheets, blueprints: base.map((b) => toExportBlueprint(b, at)), worktrees };
}
