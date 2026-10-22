import { BusinessRuleError, NotFoundError } from "../../shared/errors.js";
import type { Clock } from "../../shared/clock.js";
import { desktopSessionIdOf, toDesktopLink, type DesktopSessionReader } from "./sessions.desktop.js";
import type { ExportRun, OpsExportReader, ProjectFile, SessionFile } from "./sessions.export.js";
import type { GitPlace, OutsideSession, OutsideSessionReader } from "./sessions.outside.js";
import type { DesktopSessionLinkRepository, SessionArchiveRepository } from "./sessions.repository.js";
import type { SessionArchive } from "./sessions.table.js";
import { closeBlockerSchema, type CloseBlocker, type Project, type Session, type SessionsResponse } from "./sessions.schema.js";

// The plugin cuts a run's request at this length.
const REQUEST_LIMIT = 200;

// Wrapper tags the harness puts around a prompt: a pasted block is the request itself, any other
// leading block (a view context, a reminder) is not part of it (`session` BR-10).
const UNWRAP = new Set(["pasted_content"]);

export function cleanRequest(raw: string): { text: string; isCut: boolean } {
  const isCut = raw.length >= REQUEST_LIMIT;
  let text = raw.trimStart();
  for (;;) {
    const open = /^<([a-zA-Z][\w-]*)(?:\s[^>]*)?>/.exec(text);
    const name = open?.[1];
    if (!open || name === undefined) break;
    const rest = text.slice(open[0].length);
    if (UNWRAP.has(name)) {
      text = rest.replace(new RegExp(`</${name}>`), "").trimStart();
      continue;
    }
    const close = rest.indexOf(`</${name}>`);
    // A context block the export cut before its end leaves nothing of the request.
    text = close < 0 ? "" : rest.slice(close + name.length + 3).trimStart();
  }
  return { text: text.trimEnd(), isCut };
}

const norm = (path: string) => path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
const lastSegment = (path: string) => path.replace(/\\/g, "/").replace(/\/+$/, "").split("/").pop() ?? path;
// A repository is named by its git common dir (`{main checkout}/.git`).
const mainRootOf = (repo: string) => repo.replace(/\/\.git\/?$/i, "");

// A session file may lack its repository (its first hook was not a SessionStart, or git timed out): its
// folder's project file names it then, so a worktree never shows as a project of its own (`session` BR-05).
const projectIdOf = (file: SessionFile, projectFiles: ProjectFile[]) =>
  file.repo ?? projectFiles.find((p) => norm(p.root) === norm(file.root))?.repo ?? file.root;

// `outsideGit`: the repository read from the folder of the sessions outside selo, by project id; a project only they show
// takes its branch from there and has no count of uncommitted files.
function projectsOf(ids: string[], projectFiles: ProjectFile[], outsideGit: Map<string, GitPlace | null>): Project[] {
  return [...new Set(ids)].map((id) => {
    const files = projectFiles.filter((p) => (p.repo ?? p.root) === id);
    const main = files.find((p) => norm(p.root) === norm(mainRootOf(id))) ?? files[0];
    const name = main?.manifest?.name ?? lastSegment(mainRootOf(id));
    if (main === undefined && outsideGit.has(id)) return { id, name, branch: outsideGit.get(id)?.mainBranch ?? null, changedCount: null };
    return { id, name, branch: main?.branch ?? null, changedCount: main?.changedCount ?? 0 };
  });
}

const BLOCKERS = new Set<string>(closeBlockerSchema.options);
export const OUTSIDE_LANE = "outside";
// `session` BR-07: a run that waits on nobody can be archived.
const ARCHIVABLE = new Set<string>(["job-done", "turn-ended"]);

function toSession(
  file: SessionFile,
  current: ExportRun,
  archive: SessionArchive | undefined,
  projectFiles: ProjectFile[],
  desktopSessionId: string | undefined,
): Session {
  // An archive covers the run it was made on: a new run brings the session back (`session` BR-09).
  const isArchived = archive !== undefined && archive.runId === current.id;
  const ownProject = projectFiles.find((p) => norm(p.root) === norm(file.root));
  const { text, isCut } = cleanRequest(current.request ?? "");
  const since = Date.parse(current.since);
  return {
    id: file.sessionId,
    projectId: projectIdOf(file, projectFiles),
    branch: ownProject?.branch ?? null,
    folder: file.root,
    lane: current.lane,
    request: text,
    isRequestCut: isCut,
    blueprint: current.blueprint ? `.planning/blueprints/${current.blueprint}.md` : null,
    step: current.step ?? null,
    substep: current.substep ?? null,
    state: current.phase,
    isClosed: file.status === "ended",
    isArchived,
    archivedAt: isArchived ? archive.archivedAt.toISOString() : null,
    canArchive: ARCHIVABLE.has(current.phase) && !isArchived,
    question: current.question ?? null,
    pendingCommit: current.pendingCommit ? { subject: current.pendingCommit.subject, body: current.pendingCommit.body ?? "" } : null,
    error: current.error ?? null,
    recap: current.recap?.text ?? null,
    commits: (current.commits ?? []).map(({ sha, subject }) => ({ sha, subject })),
    nextAction: current.resumePrompt ?? null,
    model: file.model ?? null,
    effort: file.effort ?? null,
    permissionMode: file.permissionMode ?? null,
    blockers: (file.close?.blockers ?? []).filter((b): b is CloseBlocker => BLOCKERS.has(b)),
    subagents: file.runs
      .filter((r) => r.agentId && Date.parse(r.since) >= since)
      .map((r) => ({ type: r.request ?? "", task: r.task ?? null, state: r.phase })),
    touchedFiles: file.touchedFiles ?? [],
    desktopLink: toDesktopLink(desktopSessionId),
    isOutsideSelo: false,
    updatedAt: new Date(file.writtenAt).toISOString(),
  };
}

// A session outside selo is known only by its project's id, its run and its state: the export's fields stay empty.
const projectIdOfOutside = (outside: OutsideSession) => outside.git?.repo ?? outside.folder;
// `session` BR-09: the last person prompt starts a run; before any, the process's start does.
const runIdOf = (outside: OutsideSession) => outside.transcript?.lastPromptId ?? `started:${outside.status.startedAt}`;

function toOutsideSession(outside: OutsideSession, archive: SessionArchive | undefined): Session {
  const { status, transcript } = outside;
  const isArchived = archive !== undefined && archive.runId === runIdOf(outside);
  // `statusUpdatedAt` moves only when the status changes: the transcript tells a turn that keeps working.
  const statusAt = status.statusUpdatedAt ?? status.updatedAt ?? status.startedAt;
  const updatedAt = Math.max(statusAt, transcript?.modifiedAt ?? 0);
  // The prompt is whole: never marked cut. With no readable prompt, the name Claude Code gave the session.
  const prompt = transcript?.request == null ? "" : cleanRequest(transcript.request).text;
  return {
    id: status.sessionId,
    projectId: projectIdOfOutside(outside),
    branch: outside.git?.branch ?? null,
    folder: outside.folder,
    lane: OUTSIDE_LANE,
    request: prompt || (status.name ?? "").trim(),
    isRequestCut: false,
    blueprint: null,
    step: null,
    substep: null,
    state: outside.state,
    isClosed: false,
    isArchived,
    archivedAt: isArchived ? archive.archivedAt.toISOString() : null,
    canArchive: ARCHIVABLE.has(outside.state) && !isArchived,
    question: null,
    pendingCommit: null,
    error: null,
    recap: null,
    commits: [],
    nextAction: null,
    model: transcript?.model ?? null,
    effort: null,
    permissionMode: null,
    blockers: [],
    subagents: [],
    touchedFiles: [],
    // Computed from the status file on each read, never stored: the link table keeps the export's sessions only.
    desktopLink: toDesktopLink(desktopSessionIdOf(status) ?? undefined),
    isOutsideSelo: true,
    updatedAt: new Date(updatedAt).toISOString(),
  };
}

export function createSessionService({
  opsExport,
  outsideSessions,
  archives,
  desktopSessions,
  desktopLinks,
  clock,
}: {
  opsExport: OpsExportReader;
  outsideSessions: OutsideSessionReader;
  archives: SessionArchiveRepository;
  desktopSessions: DesktopSessionReader;
  desktopLinks: DesktopSessionLinkRepository;
  clock: Clock;
}) {
  // `session` BR-11: a link seen in a status file is kept, the file goes when the process ends.
  // Only the export's sessions are kept: a desktop session outside selo never reaches the table.
  const desktopSessionIds = async (exported: Set<string>) => {
    const stored = new Map((await desktopLinks.list()).map((l) => [l.sessionId, l.desktopSessionId]));
    const seen = [...desktopSessions.read()].filter(([sessionId, id]) => exported.has(sessionId) && stored.get(sessionId) !== id);
    await desktopLinks.saveMany(seen.map(([sessionId, desktopSessionId]) => ({ sessionId, desktopSessionId })));
    for (const [sessionId, id] of seen) stored.set(sessionId, id);
    return stored;
  };

  const currentOf = (file: SessionFile) => file.current ?? file.runs.find((r) => !r.agentId) ?? null;

  // The run and state of a session of the export, else of a running session outside selo; gone from both: 404.
  const findRun = (id: string): { runId: string; state: ExportRun["phase"] } => {
    const files = opsExport.read().sessions;
    const file = files.find((s) => s.sessionId === id);
    const current = file && currentOf(file);
    if (current) return { runId: current.id, state: current.phase };
    const outside = outsideSessions.read(new Set(files.map((s) => s.sessionId))).find((o) => o.status.sessionId === id);
    if (outside) return { runId: runIdOf(outside), state: outside.state };
    throw new NotFoundError("Session", id);
  };

  return {
    async list(): Promise<SessionsResponse> {
      const { sessions, projects } = opsExport.read();
      // A session with no run yet holds no request: nothing to show.
      const withRun = sessions.flatMap((file) => {
        const current = currentOf(file);
        return current ? [{ file, current }] : [];
      });
      // Every file of the export, run or not, keeps its session out of those outside selo (`session` BR-12).
      const outside = outsideSessions.read(new Set(sessions.map((s) => s.sessionId)));
      const byId = new Map((await archives.list()).map((a) => [a.sessionId, a]));
      const desktopIds = await desktopSessionIds(new Set(withRun.map(({ file }) => file.sessionId)));
      const exportIds = withRun.map(({ file }) => projectIdOf(file, projects));
      const exportProjects = new Set(exportIds);
      const outsideGit = new Map(outside.filter((o) => !exportProjects.has(projectIdOfOutside(o))).map((o) => [projectIdOfOutside(o), o.git]));
      return {
        sessions: [
          ...withRun.map(({ file, current }) => toSession(file, current, byId.get(file.sessionId), projects, desktopIds.get(file.sessionId))),
          ...outside.map((o) => toOutsideSession(o, byId.get(o.status.sessionId))),
        ],
        projects: projectsOf([...exportIds, ...outside.map(projectIdOfOutside)], projects, outsideGit),
      };
    },

    async archive(id: string): Promise<void> {
      const { runId, state } = findRun(id);
      if (!ARCHIVABLE.has(state)) throw new BusinessRuleError("session_not_done", `Session ${id} is neither done nor at a turn end`);
      await archives.save({ sessionId: id, runId, archivedAt: clock.now() });
    },

    async unarchive(id: string): Promise<void> {
      findRun(id);
      await archives.remove(id);
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
