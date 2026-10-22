import { BusinessRuleError, NotFoundError } from "../../shared/errors.js";
import type { Clock } from "../../shared/clock.js";
import type { ExportRun, OpsExportReader, ProjectFile, SessionFile } from "./sessions.export.js";
import type { SessionArchiveRepository } from "./sessions.repository.js";
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

function projectsOf(sessions: SessionFile[], projectFiles: ProjectFile[]): Project[] {
  const ids = [...new Set(sessions.map((s) => projectIdOf(s, projectFiles)))];
  return ids.map((id) => {
    const files = projectFiles.filter((p) => (p.repo ?? p.root) === id);
    const main = files.find((p) => norm(p.root) === norm(mainRootOf(id))) ?? files[0];
    const name = main?.manifest?.name ?? lastSegment(mainRootOf(id));
    return { id, name, branch: main?.branch ?? null, changedCount: main?.changedCount ?? 0 };
  });
}

const BLOCKERS = new Set<string>(closeBlockerSchema.options);

function toSession(file: SessionFile, current: ExportRun, archive: SessionArchive | undefined, projectFiles: ProjectFile[]): Session {
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
    canArchive: current.phase === "job-done" && !isArchived,
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
    updatedAt: new Date(file.writtenAt).toISOString(),
  };
}

export function createSessionService({ opsExport, archives, clock }: { opsExport: OpsExportReader; archives: SessionArchiveRepository; clock: Clock }) {
  const currentOf = (file: SessionFile) => file.current ?? file.runs.find((r) => !r.agentId) ?? null;

  const findSession = (id: string) => {
    const file = opsExport.read().sessions.find((s) => s.sessionId === id);
    const current = file && currentOf(file);
    if (!file || !current) throw new NotFoundError("Session", id);
    return { file, current };
  };

  return {
    async list(): Promise<SessionsResponse> {
      const { sessions, projects } = opsExport.read();
      // A session with no run yet holds no request: nothing to show.
      const withRun = sessions.flatMap((file) => {
        const current = currentOf(file);
        return current ? [{ file, current }] : [];
      });
      const byId = new Map((await archives.list()).map((a) => [a.sessionId, a]));
      return {
        sessions: withRun.map(({ file, current }) => toSession(file, current, byId.get(file.sessionId), projects)),
        projects: projectsOf(
          withRun.map(({ file }) => file),
          projects,
        ),
      };
    },

    async archive(id: string): Promise<void> {
      const { current } = findSession(id);
      // `session` BR-07: only a finished run is archived.
      if (current.phase !== "job-done") throw new BusinessRuleError("session_not_done", `Session ${id} is not done`);
      await archives.save({ sessionId: id, runId: current.id, archivedAt: clock.now() });
    },

    async unarchive(id: string): Promise<void> {
      findSession(id);
      await archives.remove(id);
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
