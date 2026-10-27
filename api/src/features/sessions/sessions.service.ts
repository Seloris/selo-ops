import { NotFoundError } from "../../shared/errors.js";
import type { Clock } from "../../shared/clock.js";
import { desktopSessionIdOf, toDesktopLink, type DesktopSessionReader } from "./sessions.desktop.js";
import type { ExportRun, ExportUsage, OpsExportReader, ProjectFile, SessionFile } from "./sessions.export.js";
import type { FileStat, GitDiffReader } from "./sessions.git.js";
import type { InstalledPluginReader } from "./sessions.plugins.js";
import type { GitPlace, OutsideSession, OutsideSessionReader, PermissionWait } from "./sessions.outside.js";
import type { DesktopSessionLinkRepository, SessionArchiveRepository, SessionNoteRepository } from "./sessions.repository.js";
import type { SessionArchive } from "./sessions.table.js";
import { closeBlockerSchema, type CloseBlocker, type FileDiff, type FileSummary, type Project, type Session, type SessionsResponse, type SessionTrails, type Usage } from "./sessions.schema.js";

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

// The export keeps a session's latest 100 runs, subagents included.
const EXPORT_MAX_RUNS = 100;

// A recorded sha as git prints it; anything else never reaches git.
const SHA = /^[0-9a-f]{4,40}$/i;
const GIT_PARALLEL = 4;

// The commits the export recorded for the session's runs, oldest run first, each sha once: only a hex sha reaches git.
function recordedCommits(session: SessionFile): Map<string, string> {
  const commits = new Map<string, string>();
  const runs = [...session.runs, ...(session.current ? [session.current] : [])].sort((a, b) => Date.parse(a.since) - Date.parse(b.since));
  for (const run of runs) for (const c of run.commits ?? []) if (SHA.test(c.sha) && !commits.has(c.sha)) commits.set(c.sha, c.subject);
  return commits;
}

const STATUS = { A: "added", M: "modified", D: "deleted" } as const;

// One file over its parts, oldest first: deleted when the last part removes it, added when the first creates it.
function summarize(file: string, parts: FileStat[][], uncommitted: FileStat[]): FileSummary["files"][number] {
  const stats = parts.flatMap((part) => part.filter((s) => s.file === file));
  const first = stats[0];
  const last = stats[stats.length - 1];
  const sum = (key: "added" | "removed") => stats.reduce<number | null>((total, s) => (total === null || s[key] === null ? null : total + s[key]), 0);
  return {
    file,
    status: !first || !last ? null : last.status === "D" ? STATUS.D : STATUS[first.status === "A" ? "A" : "M"],
    added: sum("added"),
    removed: sum("removed"),
    isUncommitted: uncommitted.some((s) => s.file === file),
  };
}

const BLOCKERS = new Set<string>(closeBlockerSchema.options);

// The `Usage` part of a run's usage: a subagent's tools, skills and prompts stay off the 5 s poll.
const usageOf = (usage: ExportUsage | null | undefined): Usage | null =>
  usage ? { calls: usage.calls, tokens: usage.tokens, byModel: usage.byModel } : null;

const topModelOf = (run: ExportRun) => run.usage?.byModel[0]?.model ?? null;

// `session` BR-20: the export's model is null before its first Stop; the latest main run that has usage then tells it,
// never a subagent's, which may run on another model.
function modelOf(file: SessionFile): string | null {
  if (file.model) return file.model;
  const latest = file.runs
    .filter((r) => !r.agentId && topModelOf(r) !== null)
    .sort((a, b) => Date.parse(b.since) - Date.parse(a.since))[0];
  return latest ? topModelOf(latest) : null;
}
// The main runs, oldest first, the current one from the export's freshest copy, listed even when `runs` does not hold it yet.
const mainRunsOf = (file: SessionFile, current: ExportRun) =>
  [...file.runs.filter((r) => !r.agentId && r.id !== current.id), ...(current.agentId ? [] : [current])].sort((a, b) => Date.parse(a.since) - Date.parse(b.since));

const toSubagent = (r: ExportRun) => ({
  type: r.request ?? "",
  task: r.task ?? null,
  state: r.phase,
  since: r.since,
  updatedAt: r.updatedAt,
  model: topModelOf(r),
  usage: usageOf(r.usage),
});

function toSession(
  file: SessionFile,
  current: ExportRun,
  archive: SessionArchive | undefined,
  projectFiles: ProjectFile[],
  desktopSessionId: string | undefined,
  transcriptStart: number | undefined,
  permissionWait: PermissionWait | undefined,
  isAnswerWait: boolean,
  imageRequestRunIds: Set<string>,
): Omit<Session, "note"> {
  // An archive covers the run it was made on: a new run brings the session back (`session` BR-09).
  const isArchived = archive !== undefined && archive.runId === current.id;
  const ownProject = projectFiles.find((p) => norm(p.root) === norm(file.root));
  const { text, isCut } = cleanRequest(current.request ?? "");
  const since = Date.parse(current.since);
  const subagents = file.runs.filter((r) => r.agentId && Date.parse(r.since) >= since);
  const isClosed = file.status === "ended";
  // A turn that ends with subagents in the background has not finished its work (`session` BR-02).
  const isCalm = current.phase === "turn-ended" || current.phase === "job-done";
  const phase = !isClosed && isCalm && subagents.some((r) => r.phase === "working") ? "working" : current.phase;
  // A permission dialog holds the run whatever its phase (`session` BR-16); a question the export missed holds a
  // working one (`session` BR-17).
  const isMissedQuestion = !permissionWait && isAnswerWait && phase === "working";
  const state = permissionWait ? "awaiting-permission" : isMissedQuestion ? "awaiting-answer" : phase;
  // The export keeps the latest runs only: a long session's first run may be gone, its transcript is not.
  const createdAt = transcriptStart ?? Math.min(...file.runs.map((r) => Date.parse(r.since)), since);
  return {
    id: file.sessionId,
    projectId: projectIdOf(file, projectFiles),
    branch: ownProject?.branch ?? null,
    folder: file.root,
    // `session` BR-22: a run with no flow is a free one.
    flow: current.flow ?? "free",
    skill: current.skill ?? null,
    mode: current.mode ?? null,
    trail: current.trail,
    isTrailCut: current.trailCut ?? false,
    request: text,
    isRequestCut: isCut,
    isRequestImage: imageRequestRunIds.has(current.id),
    blueprint: current.blueprint ? `.planning/blueprints/${current.blueprint}.md` : null,
    step: current.step ?? null,
    substep: current.substep ?? null,
    state,
    isClosed,
    isArchived,
    archivedAt: isArchived ? archive.archivedAt.toISOString() : null,
    canArchive: !isArchived,
    // The export holds no text for a question it missed; one it kept is an earlier question's.
    question: isMissedQuestion ? null : (current.question ?? null),
    permissionTool: permissionWait?.tool ?? null,
    pendingCommit: current.pendingCommit ? { subject: current.pendingCommit.subject, body: current.pendingCommit.body ?? "" } : null,
    error: current.error ?? null,
    recap: current.recap?.text ?? null,
    commits: (current.commits ?? []).map(({ sha, subject }) => ({ sha, subject })),
    nextAction: current.resumePrompt ?? current.next[0]?.prompt ?? null,
    nextSteps: current.next.map(({ text, prompt }) => ({ summary: text, command: prompt })),
    model: modelOf(file),
    effort: file.effort ?? null,
    permissionMode: file.permissionMode ?? null,
    blockers: (file.close?.blockers ?? []).filter((b): b is CloseBlocker => BLOCKERS.has(b)),
    subagents: subagents.map(toSubagent),
    usage: usageOf(file.usage),
    runUsage: current.usage ?? null,
    runs: mainRunsOf(file, current).map((r) => {
      const request = cleanRequest(r.request ?? "");
      return {
        since: r.since,
        request: request.text,
        isRequestCut: request.isCut,
        isRequestImage: imageRequestRunIds.has(r.id),
        usage: r.usage ?? null,
      };
    }),
    isRunListCut: file.runs.length >= EXPORT_MAX_RUNS,
    touchedFiles: file.touchedFiles ?? [],
    desktopLink: toDesktopLink(desktopSessionId),
    isOutsideSelo: false,
    writtenBy: file.writtenBy ?? null,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(file.writtenAt).toISOString(),
  };
}

// A session outside selo is known only by its project's id, its run and its state: the export's fields stay empty.
const projectIdOfOutside = (outside: OutsideSession) => outside.git?.repo ?? outside.folder;
// `session` BR-09: the last person prompt starts a run; before any, the process's start does.
const runIdOf = (outside: OutsideSession) => outside.transcript?.runKey ?? `started:${outside.status.startedAt}`;

function toOutsideSession(outside: OutsideSession, archive: SessionArchive | undefined): Omit<Session, "note"> {
  const { status, transcript } = outside;
  const isArchived = archive !== undefined && archive.runId === runIdOf(outside);
  // `statusUpdatedAt` moves only when the status changes: the transcript tells a turn that keeps working.
  const statusAt = status.statusUpdatedAt ?? status.updatedAt ?? status.startedAt;
  const updatedAt = Math.max(statusAt, transcript?.modifiedAt ?? 0);
  // With no readable prompt, the name Claude Code gave the session.
  const prompt = transcript?.request == null ? "" : cleanRequest(transcript.request).text;
  const isRequestCut = prompt !== "" && (transcript?.isRequestCut ?? false);
  return {
    id: status.sessionId,
    projectId: projectIdOfOutside(outside),
    branch: outside.git?.branch ?? null,
    folder: outside.folder,
    flow: "free",
    skill: null,
    mode: null,
    trail: [],
    isTrailCut: false,
    request: prompt || (status.name ?? "").trim(),
    isRequestCut,
    isRequestImage: false,
    blueprint: null,
    step: null,
    substep: null,
    state: outside.permissionWait ? "awaiting-permission" : outside.state,
    isClosed: false,
    isArchived,
    archivedAt: isArchived ? archive.archivedAt.toISOString() : null,
    canArchive: !isArchived,
    question: null,
    permissionTool: outside.permissionWait?.tool ?? null,
    pendingCommit: null,
    error: null,
    recap: null,
    commits: [],
    nextAction: null,
    nextSteps: [],
    model: transcript?.model ?? null,
    effort: null,
    permissionMode: null,
    blockers: [],
    subagents: [],
    // `session` BR-18: only the export gives usage.
    usage: null,
    runUsage: null,
    runs: [],
    isRunListCut: false,
    touchedFiles: [],
    // Computed from the status file on each read, never stored: the link table keeps the export's sessions only.
    desktopLink: toDesktopLink(desktopSessionIdOf(status) ?? undefined),
    isOutsideSelo: true,
    writtenBy: null,
    createdAt: new Date(transcript?.startedAt ?? status.startedAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
  };
}

export function createSessionService({
  opsExport,
  outsideSessions,
  archives,
  notes,
  desktopSessions,
  desktopLinks,
  installedPlugins,
  git,
  questionRuns,
  clock,
}: {
  opsExport: OpsExportReader;
  outsideSessions: OutsideSessionReader;
  archives: SessionArchiveRepository;
  notes: SessionNoteRepository;
  desktopSessions: DesktopSessionReader;
  desktopLinks: DesktopSessionLinkRepository;
  installedPlugins: InstalledPluginReader;
  git: GitDiffReader;
  // The runs answering questions, never listed (`session` BR-12).
  questionRuns: { runSessionIds(): Promise<Set<string>> };
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

  // A session deleted in Claude Code is still the export's: never shown as outside selo (`session` BR-12, BR-14); nor is
  // a question's run (`question` BR-01).
  const exportedIds = async (files: SessionFile[], deleted: Set<string>) =>
    new Set([...files.map((s) => s.sessionId), ...deleted, ...(await questionRuns.runSessionIds())]);

  // The run of a session of the export, else of a running session outside selo; gone from both: 404.
  const findRun = async (id: string): Promise<string> => {
    const { sessions: files, deletedSessionIds } = opsExport.read();
    const file = files.find((s) => s.sessionId === id);
    const current = file && currentOf(file);
    if (current) return current.id;
    const { outside: running } = outsideSessions.read({ exported: await exportedIds(files, deletedSessionIds), now: clock.now().getTime() });
    const outside = running.find((o) => o.status.sessionId === id);
    if (outside) return runIdOf(outside);
    throw new NotFoundError("Session", id);
  };

  return {
    async list(): Promise<SessionsResponse> {
      const { sessions, projects, deletedSessionIds, transcriptStarts, imageRequestRunIds } = opsExport.read();
      // A session with no run yet holds no request: nothing to show.
      const withRun = sessions.flatMap((file) => {
        const current = currentOf(file);
        return current ? [{ file, current }] : [];
      });
      // Every file of the export, run or not, keeps its session out of those outside selo (`session` BR-12).
      const open = withRun.filter(({ file }) => file.status !== "ended").map(({ file: { sessionId, root, rootKey } }) => ({ sessionId, root, rootKey }));
      const { outside, permissionWaits, answerWaits } = outsideSessions.read({ exported: await exportedIds(sessions, deletedSessionIds), open, now: clock.now().getTime() });
      const byId = new Map((await archives.list()).map((a) => [a.sessionId, a]));
      const noteOf = new Map((await notes.list()).map((n) => [n.sessionId, n.text]));
      const withNote = (session: Omit<Session, "note">): Session => ({ ...session, note: noteOf.get(session.id) ?? null });
      const desktopIds = await desktopSessionIds(new Set(withRun.map(({ file }) => file.sessionId)));
      const exportIds = withRun.map(({ file }) => projectIdOf(file, projects));
      const exportProjects = new Set(exportIds);
      const outsideGit = new Map(outside.filter((o) => !exportProjects.has(projectIdOfOutside(o))).map((o) => [projectIdOfOutside(o), o.git]));
      return {
        sessions: [
          ...withRun.map(({ file, current }) =>
            withNote(toSession(
              file,
              current,
              byId.get(file.sessionId),
              projects,
              desktopIds.get(file.sessionId),
              transcriptStarts.get(file.sessionId),
              permissionWaits.get(file.sessionId),
              answerWaits.has(file.sessionId),
              imageRequestRunIds,
            )),
          ),
          ...outside.map((o) => withNote(toOutsideSession(o, byId.get(o.status.sessionId)))),
        ],
        projects: projectsOf([...exportIds, ...outside.map(projectIdOfOutside)], projects, outsideGit),
        plugins: installedPlugins.read(),
      };
    },

    async archive(id: string): Promise<void> {
      const runId = await findRun(id);
      await archives.save({ sessionId: id, runId, archivedAt: clock.now() });
    },

    async unarchive(id: string): Promise<void> {
      await findRun(id);
      await archives.remove(id);
    },

    // sessions-live FR-41: the earlier main runs' history, each with the subagents started before the next main run.
    async trails(id: string): Promise<SessionTrails> {
      const { sessions, imageRequestRunIds } = opsExport.read();
      const file = sessions.find((s) => s.sessionId === id);
      const current = file && currentOf(file);
      if (!file || !current) throw new NotFoundError("Session", id);
      const mainRuns = mainRunsOf(file, current);
      return {
        runs: mainRuns.flatMap((r, i) => {
          if (r === current) return [];
          const request = cleanRequest(r.request ?? "");
          const from = Date.parse(r.since);
          const next = mainRuns[i + 1];
          const until = next ? Date.parse(next.since) : Infinity;
          return [
            {
              since: r.since,
              request: request.text,
              isRequestCut: request.isCut,
              isRequestImage: imageRequestRunIds.has(r.id),
              mode: r.mode ?? null,
              trail: r.trail,
              isTrailCut: r.trailCut ?? false,
              subagents: file.runs.filter((a) => a.agentId && Date.parse(a.since) >= from && Date.parse(a.since) < until).map(toSubagent),
            },
          ];
        }),
      };
    },

    // `session` BR-01: each touched file's status and lines, over its recorded commits, then its uncommitted part.
    async fileSummary(id: string): Promise<FileSummary> {
      const session = opsExport.read().sessions.find((s) => s.sessionId === id);
      if (!session) throw new NotFoundError("Session", id);
      if (!(await git.isCheckout(session.root))) return { isAvailable: false, files: [] };
      const touched = session.touchedFiles ?? [];
      const shas = [...recordedCommits(session).keys()];
      const parts: FileStat[][] = [];
      for (let i = 0; i < shas.length; i += GIT_PARALLEL) {
        const read = await Promise.all(shas.slice(i, i + GIT_PARALLEL).map((sha) => git.commitStats(session.root, sha, touched)));
        for (const stats of read) if (stats) parts.push(stats);
      }
      const uncommitted = await git.uncommittedStats(session.root, touched);
      return { isAvailable: true, files: touched.map((file) => summarize(file, [...parts, uncommitted], uncommitted)) };
    },

    // `session` BR-01: only a file the session touched, only commits the export recorded, so nothing the caller
    // sends reaches git but a path and a sha it already holds.
    async fileDiff(id: string, file: string): Promise<FileDiff> {
      const session = opsExport.read().sessions.find((s) => s.sessionId === id);
      if (!session) throw new NotFoundError("Session", id);
      if (!(session.touchedFiles ?? []).includes(file)) throw new NotFoundError("Touched file", file);
      if (!(await git.isCheckout(session.root))) return { file, isAvailable: false, commits: [], uncommitted: null };
      const commits = recordedCommits(session);
      // A few git processes at once: a long session's commits neither queue for minutes nor flood the machine.
      const entries = [...commits];
      const texts: Awaited<ReturnType<GitDiffReader["commitDiff"]>>[] = [];
      for (let i = 0; i < entries.length; i += GIT_PARALLEL) {
        texts.push(...(await Promise.all(entries.slice(i, i + GIT_PARALLEL).map(([sha]) => git.commitDiff(session.root, sha, file)))));
      }
      const parts = entries.flatMap(([sha, subject], i): FileDiff["commits"] => {
        const text = texts[i];
        if (text === null || text === undefined) return [{ sha, subject, diff: null, isCut: false }];
        return text.diff === "" ? [] : [{ sha, subject, ...text }];
      });
      return { file, isAvailable: true, commits: parts, uncommitted: await git.uncommittedDiff(session.root, file) };
    },

    // `session` BR-21: one note per session, kept across runs; an empty text removes it.
    async saveNote(id: string, text: string): Promise<void> {
      await findRun(id);
      if (text === "") await notes.remove(id);
      else await notes.save({ sessionId: id, text, updatedAt: clock.now() });
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
