import { NotFoundError } from "../../shared/errors.js";
import type { ExportBlueprint, ExportSheet, OpsExportReader, ProjectFile, SessionFile } from "../sessions/sessions.export.js";
import type { PlanningReader } from "./projects.planning.js";
import type { SlotReader } from "./projects.slots.js";
import type { Blueprint, Project, ProjectSlot, ProjectFileResponse, ProjectsResponse, SpecSheet } from "./projects.schema.js";

export const IDEAS_FILE = ".planning/ideas.md";
export const DEBT_FILE = ".planning/technical-debt.md";

const norm = (path: string) => path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
const lastSegment = (path: string) => path.replace(/\\/g, "/").replace(/\/+$/, "").split("/").pop() ?? path;
const mainRootOf = (repo: string) => repo.replace(/\/\.git\/?$/i, "");
// As the export names its files after a root.
const keyOf = (root: string) => root.replace(/[^A-Za-z0-9]/g, "-");
// One item per top-level bullet: the files' headers are prose.
const countItems = (text: string | null) => (text === null ? 0 : (text.match(/^- /gm) ?? []).length);

interface Checkouts {
  base: ProjectFile;
  worktrees: ProjectFile[];
}

const sameRepo = (a: ProjectFile, b: ProjectFile) => a.repo != null && b.repo != null && norm(a.repo) === norm(b.repo);

// `project` BR-01: the base checkout is the folder whose repository is its own; another file of that repository is a
// worktree when it is on another branch (git never checks one branch out twice) and no checkout of its branch holds its
// folder; a folder inside a checkout, on its branch (a project nested in a bigger repository), stands as a project of its own.
function groupCheckouts(files: ProjectFile[]): Checkouts[] {
  const isBase = (f: ProjectFile) => f.repo != null && norm(f.root) === norm(mainRootOf(f.repo));
  const isNested = (f: ProjectFile) =>
    files.some((g) => g !== f && sameRepo(f, g) && g.branch === f.branch && norm(f.root).startsWith(`${norm(g.root)}/`));
  const bases = files.filter(isBase);
  const baseOf = (f: ProjectFile) => (isNested(f) ? undefined : bases.find((b) => b !== f && sameRepo(b, f) && b.branch !== f.branch));
  return files
    .filter((f) => baseOf(f) === undefined)
    .map((base) => ({ base, worktrees: files.filter((f) => baseOf(f) === base) }));
}

// `project` BR-04: no sheet nor blueprint read, and no manifest read cleanly.
const hasPlanningOf = (f: ProjectFile) => f.sheets.length > 0 || f.blueprints.length > 0 || (f.manifest != null && f.error == null);

// The open blueprints whose header or delta names the sheet, a worktree's own included (`project` BR-01).
const touching = (s: ExportSheet, blueprints: Blueprint[]) => {
  const key = s.component ? `${s.component}/${s.slug}` : s.slug;
  return blueprints
    .filter((b) => b.state !== "done" && b.state !== "legacy" && (b.sheets.includes(key) || b.delta.some((d) => d.sheet === key)))
    .map((b) => b.name);
};

const STUB_LINE = /^Status: to bootstrap\s*$/m;

const toSheet = (s: ExportSheet, blueprints: Blueprint[], text: string | null): SpecSheet => ({
  kind: s.kind,
  slug: s.slug,
  component: s.component ?? null,
  file: s.file,
  title: s.title,
  route: s.route ?? null,
  isStub: text !== null && STUB_LINE.test(text),
  frCount: s.ids.fr,
  brCount: s.ids.br,
  nextFr: s.ids.next.fr,
  nextBr: s.ids.next.br,
  lastCommit: s.lastCommit ?? null,
  openBlueprints: touching(s, blueprints),
});

function toBlueprint(b: ExportBlueprint, worktreeBranch: string | null, sessionIds: string[]): Blueprint {
  return {
    name: b.name,
    file: b.file,
    title: b.title,
    sheets: b.sheets,
    components: b.components,
    state: b.state,
    delta: b.delta,
    decisions: b.decisions ?? [],
    // `project` BR-03.
    stages: b.state === "legacy" ? [] : b.stages.map((s) => ({ number: s.number, component: s.component, commit: s.commit, sha: s.sha ?? null, isDone: s.done })),
    isReviewDone: b.progress.reviewDone,
    isSpecMerged: b.progress.specMerged,
    nextPrompt: b.next?.prompt ?? null,
    sessionIds,
    worktreeBranch,
    modifiedAt: b.modifiedAt ?? null,
  };
}

// Where each readable file of a project lives: the export's files, a worktree-only blueprint in its worktree.
function filesOf({ base, worktrees }: Checkouts): Map<string, string> {
  const files = new Map<string, string>();
  // As the list does, the first worktree holding a blueprint is the one read.
  for (const w of worktrees) for (const b of w.blueprints) if (!files.has(b.file)) files.set(b.file, w.root);
  for (const item of [...base.sheets, ...base.blueprints]) files.set(item.file, base.root);
  files.set(IDEAS_FILE, base.root);
  files.set(DEBT_FILE, base.root);
  return files;
}

// `project` BR-05: the runs of the repository's slots, those of its own checkouts only (a nested project shares the repository).
function slotsOf({ base, worktrees }: Checkouts, slots: SlotReader): ProjectSlot[] {
  if (base.repo == null) return [];
  const checkouts = [base, ...worktrees];
  return slots
    .read(base.repo)
    .flatMap(({ slot, root, startedAt, isRunning, components }) => {
      const checkout = checkouts.find((c) => norm(c.root) === norm(root));
      return checkout === undefined ? [] : [{ number: slot, root, branch: checkout.branch ?? null, startedAt, isRunning, components }];
    })
    .sort((a, b) => a.number - b.number);
}

function toProject(checkouts: Checkouts, liveSessions: SessionFile[], planning: PlanningReader, slots: SlotReader): Project {
  const { base, worktrees } = checkouts;
  const roots = new Set([base, ...worktrees].map((f) => norm(f.root)));
  const sessions = liveSessions.filter((s) => roots.has(norm(s.root)));
  const sessionsOn = (name: string) => sessions.filter((s) => s.current?.blueprint === name).map((s) => s.sessionId);
  const hasPlanning = hasPlanningOf(base);
  const baseNames = new Set(base.blueprints.map((b) => b.name));
  const worktreeOnly = worktrees.flatMap((w) =>
    w.blueprints.filter((b) => !baseNames.has(b.name)).map((b) => ({ b, branch: w.branch ?? null })),
  );
  const blueprints = hasPlanning
    ? [...base.blueprints.map((b) => ({ b, branch: null })), ...worktreeOnly]
        // Two worktrees holding the same new blueprint: the first one listed wins.
        .filter(({ b }, i, all) => all.findIndex((x) => x.b.name === b.name) === i)
        .sort((x, y) => y.b.name.localeCompare(x.b.name))
        .map(({ b, branch }) => toBlueprint(b, branch, sessionsOn(b.name)))
    : [];
  return {
    id: keyOf(base.root),
    name: base.manifest?.name ?? lastSegment(base.root),
    root: base.root,
    branch: base.branch ?? null,
    baseBranch: base.baseBranch ?? null,
    seloVersion: base.selo ?? null,
    changedCount: base.changedCount ?? null,
    unpushedCount: base.unpushedCount ?? null,
    hasPlanning,
    error: base.error ?? null,
    worktrees: worktrees.map((w) => ({ root: w.root, branch: w.branch ?? null, aheadCount: w.aheadCount ?? null, changedCount: w.changedCount ?? null })),
    sheets: hasPlanning ? base.sheets.map((s) => toSheet(s, blueprints, planning.read(base.root, s.file))) : [],
    blueprints,
    ideaCount: hasPlanning ? countItems(planning.read(base.root, IDEAS_FILE)) : 0,
    debtCount: hasPlanning ? countItems(planning.read(base.root, DEBT_FILE)) : 0,
    sessionIds: sessions.map((s) => s.sessionId),
    slots: slotsOf(checkouts, slots),
  };
}

export function createProjectService({ opsExport, planning, slots }: { opsExport: OpsExportReader; planning: PlanningReader; slots: SlotReader }) {
  const checkoutsOf = () => {
    const { projects, sessions } = opsExport.read();
    return { groups: groupCheckouts(projects), live: sessions.filter((s) => s.status === "live") };
  };
  return {
    list: (): ProjectsResponse => {
      const { groups, live } = checkoutsOf();
      const projects = groups.map((g) => toProject(g, live, planning, slots));
      return { projects: projects.sort((a, b) => a.name.localeCompare(b.name)) };
    },
    // Only a file the export lists for the project, or its ideas or debt: never any path of the disk.
    readFile: (id: string, path: string): ProjectFileResponse => {
      const group = checkoutsOf().groups.find((g) => keyOf(g.base.root) === id);
      if (group === undefined) throw new NotFoundError("Project", id);
      const root = filesOf(group).get(path);
      const text = root === undefined ? null : planning.read(root, path);
      if (text === null) throw new NotFoundError("File", path);
      return { path, text };
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
