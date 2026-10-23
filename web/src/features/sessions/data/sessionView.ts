import type { components } from "../../../api/schema.d.ts";

// What the page derives from the API's list: order, buckets, filters, groups and counts. Pure: no React.

export type Session = components["schemas"]["Session"];
export type Project = components["schemas"]["Project"];
export type InstalledPlugin = components["schemas"]["InstalledPlugin"];
export type SessionState = components["schemas"]["SessionState"];
export type Bucket = "todo" | "run" | "rest" | "done";
export type Grouping = "project" | "status" | "none";

// `session` BR-02: the order of urgency.
export const STATE_ORDER: Record<SessionState, number> = {
  "awaiting-answer": 1,
  "awaiting-permission": 2,
  "awaiting-commit": 3,
  stopped: 4,
  working: 5,
  "turn-ended": 6,
  "job-done": 7,
};

const BUCKET: Record<SessionState, Bucket> = {
  "awaiting-answer": "todo",
  "awaiting-permission": "todo",
  "awaiting-commit": "todo",
  stopped: "todo",
  working: "run",
  "turn-ended": "rest",
  "job-done": "done",
};

export const BUCKETS: Bucket[] = ["todo", "run", "rest", "done"];

export const bucketOf = (state: SessionState): Bucket => BUCKET[state];
// `session` BR-07: only a run that waits on nobody is archived without a question.
export const isFinished = (s: Session) => bucketOf(s.state) === "rest" || bucketOf(s.state) === "done";
export const isOpen = (s: Session) => !s.isClosed && !s.isArchived;
// `session` BR-04.
export const isTodo = (s: Session) => isOpen(s) && bucketOf(s.state) === "todo";

// The age a row shows: since the archive for an archived session, since the last update otherwise.
export const ageMs = (s: Session, now: number) => now - Date.parse(s.isArchived && s.archivedAt ? s.archivedAt : s.updatedAt);

const compare = (a: Session, b: Session) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);

export const sortSessions = (list: Session[]) => [...list].sort(compare);

export interface Filters {
  // null: every project.
  projectIds: Set<string> | null;
  search: string;
}

export function matches(s: Session, filters: Filters, projects: Map<string, Project>): boolean {
  if (filters.projectIds && !filters.projectIds.has(s.projectId)) return false;
  const q = filters.search.trim().toLowerCase();
  if (!q) return true;
  const hay = [s.request, s.blueprint ?? "", s.branch ?? "", projects.get(s.projectId)?.name ?? ""].join(" ").toLowerCase();
  return hay.includes(q);
}

export interface Counts {
  open: number;
  projects: number;
  todo: number;
}

// Global: no filter applies (sessions-live FR-01).
export function countsOf(sessions: Session[]): Counts {
  const open = sessions.filter(isOpen);
  return { open: open.length, projects: new Set(open.map((s) => s.projectId)).size, todo: open.filter(isTodo).length };
}

export function openCountByProject(sessions: Session[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of sessions.filter(isOpen)) counts.set(s.projectId, (counts.get(s.projectId) ?? 0) + 1);
  return counts;
}

export interface Block {
  key: string;
  kind: "project" | "status" | "all";
  sessions: Session[];
  todoCount: number;
}

const block = (key: string, kind: Block["kind"], sessions: Session[]): Block => ({ key, kind, sessions, todoCount: sessions.filter(isTodo).length });

// The open sessions, filtered, sorted and grouped.
export function groupSessions(sessions: Session[], grouping: Grouping, filters: Filters, projects: Map<string, Project>): Block[] {
  const shown = sortSessions(sessions.filter((s) => isOpen(s) && matches(s, filters, projects)));
  if (grouping === "status") {
    return BUCKETS.map((b) => block(b, "status", shown.filter((s) => bucketOf(s.state) === b))).filter((b) => b.sessions.length > 0);
  }
  if (grouping === "project") {
    // `shown` is sorted: a project's first session is its most urgent, and Map keeps that order.
    const byProject = new Map<string, Session[]>();
    for (const s of shown) byProject.set(s.projectId, [...(byProject.get(s.projectId) ?? []), s]);
    return [...byProject].map(([id, list]) => block(id, "project", list));
  }
  return shown.length ? [block("all", "all", shown)] : [];
}

export const closedSessions = (sessions: Session[], filters: Filters, projects: Map<string, Project>) =>
  sortSessions(sessions.filter((s) => s.isClosed && !s.isArchived && matches(s, filters, projects)));

export const archivedSessions = (sessions: Session[], filters: Filters, projects: Map<string, Project>) =>
  sessions
    .filter((s) => s.isArchived && matches(s, filters, projects))
    .sort((a, b) => Date.parse(b.archivedAt ?? b.updatedAt) - Date.parse(a.archivedAt ?? a.updatedAt));
