import type { components } from "../../../api/schema.d.ts";

export type ProjectOverview = components["schemas"]["ProjectOverview"];
export type Blueprint = components["schemas"]["Blueprint"];
export type BlueprintState = components["schemas"]["BlueprintState"];
export type SpecSheet = components["schemas"]["SpecSheet"];
export type DeltaLine = Blueprint["delta"][number];

// `project` BR-02: the order the states are shown in, bars and legends included.
export const STATES: BlueprintState[] = ["draft", "ready", "building", "review", "merging", "done", "legacy"];

export const isOpenBlueprint = (b: Blueprint) => b.state !== "done" && b.state !== "legacy";

// The states a list of blueprints holds, in their order, with their count; the absent ones left out.
export function stateCounts(blueprints: Blueprint[]): { state: BlueprintState; count: number }[] {
  return STATES.map((state) => ({ state, count: blueprints.filter((b) => b.state === state).length })).filter((c) => c.count > 0);
}

// projects FR-01.
export function pageCounts(projects: ProjectOverview[]) {
  const blueprints = projects.flatMap((p) => p.blueprints);
  return {
    projects: projects.length,
    open: blueprints.filter(isOpenBlueprint).length,
    building: blueprints.filter((b) => b.state === "building").length,
  };
}

// projects FR-02: the projects with an open blueprint first, then by name.
export function sortProjects(projects: ProjectOverview[]): ProjectOverview[] {
  const hasOpen = (p: ProjectOverview) => (p.blueprints.some(isOpenBlueprint) ? 0 : 1);
  return [...projects].sort((a, b) => hasOpen(a) - hasOpen(b) || a.name.localeCompare(b.name, "fr"));
}

export function deltaSplit(delta: DeltaLine[]) {
  return {
    added: delta.filter((d) => d.op === "+").length,
    changed: delta.filter((d) => d.op === "~").length,
    removed: delta.filter((d) => d.op === "-").length,
  };
}

// projects FR-11: the delta grouped by sheet, in the order the sheets first appear.
export function deltaBySheet(delta: DeltaLine[]): { sheet: string; lines: DeltaLine[] }[] {
  const groups = new Map<string, DeltaLine[]>();
  for (const line of delta) groups.set(line.sheet, [...(groups.get(line.sheet) ?? []), line]);
  return [...groups].map(([sheet, lines]) => ({ sheet, lines }));
}

export type Step =
  | { kind: "stage"; number: number; component: string; commit: string; sha: string | null; isDone: boolean }
  | { kind: "review"; isDone: boolean }
  | { kind: "merge"; isDone: boolean };

// `project` BR-03: its stages, then its review, then its spec merged; none for a legacy blueprint.
export function progressSteps(b: Blueprint): Step[] {
  if (b.state === "legacy") return [];
  return [
    ...b.stages.map((s) => ({ kind: "stage" as const, number: s.number, component: s.component, commit: s.commit, sha: s.sha, isDone: s.isDone })),
    { kind: "review", isDone: b.isReviewDone },
    { kind: "merge", isDone: b.isSpecMerged },
  ];
}

// projects FR-08: every blueprint not legacy, newest first, and the legacy ones apart.
export function blueprintLists(blueprints: Blueprint[]) {
  const newestFirst = [...blueprints].sort((a, b) => b.name.localeCompare(a.name));
  return { listed: newestFirst.filter((b) => b.state !== "legacy"), legacy: newestFirst.filter((b) => b.state === "legacy") };
}

// projects FR-09: the pages, then the domain sheets with `app` first.
export function sheetLists(sheets: SpecSheet[]) {
  const bySlug = (a: SpecSheet, b: SpecSheet) => a.slug.localeCompare(b.slug);
  return {
    pages: sheets.filter((s) => s.kind === "page").sort(bySlug),
    domains: sheets.filter((s) => s.kind !== "page").sort((a, b) => (a.kind === "app" ? 0 : 1) - (b.kind === "app" ? 0 : 1) || bySlug(a, b)),
  };
}

// A sheet as a blueprint names it: `{component}/{slug}` with several fronts, else its slug.
export const sheetKey = (sheet: SpecSheet) => (sheet.component ? `${sheet.component}/${sheet.slug}` : sheet.slug);

// The open blueprints touching a sheet, each with its delta lines for that sheet (projects FR-12).
export function blueprintsTouching(blueprints: Blueprint[], sheet: SpecSheet) {
  const key = sheetKey(sheet);
  return blueprints
    .filter((b) => isOpenBlueprint(b) && sheet.openBlueprints.includes(b.name))
    .map((b) => ({ blueprint: b, lines: b.delta.filter((d) => d.sheet === key) }));
}

// A blueprint's date, from its name (`2026-10-23-projects-page`).
export const dateOf = (b: Blueprint) => /^(\d{4}-\d{2}-\d{2})-/.exec(b.name)?.[1] ?? null;
