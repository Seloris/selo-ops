import type { Clock } from "../../shared/clock.js";
import type { QuestionTokens } from "../questions/questions.repository.js";
import type { ExportRun, ExportUsage, OpsExportReader, ProjectFile, SessionFile } from "../sessions/sessions.export.js";
import { cleanRequest, modelOf, projectIdOf } from "../sessions/sessions.service.js";
import type { StatsQuery, StatsResponse } from "./stats.schema.js";

type Tokens = ExportUsage["tokens"];
type ModelUsage = ExportUsage["byModel"][number];

const KINDS = ["input", "cacheRead", "cacheWrite", "output"] as const;
const zero = (): Tokens => ({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0 });
const add = (a: Tokens, b: Tokens): Tokens => ({ input: a.input + b.input, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite, output: a.output + b.output });
const totalOf = (t: Tokens) => KINDS.reduce((n, k) => n + t[k], 0);

const DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;
// stats FR-05: beyond this many days, `all` shows weeks.
const MAX_DAY_BARS = 90;
const TOP_SESSIONS = 10;
const DAY_MS = 86_400_000;

// One counted piece of usage: a run, a question, or a session's undated part (`day` null).
interface Part {
  day: string | null;
  projectId: string;
  sessionId: string | null;
  flow: string;
  calls: number;
  tokens: Tokens;
  byModel: ModelUsage[];
}

// Date-only arithmetic on `YYYY-MM-DD`, through UTC so no zone shift creeps in.
const dayMs = (day: string) => Date.parse(`${day}T00:00:00.000Z`);
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const plusDays = (day: string, n: number) => dayOf(dayMs(day) + n * DAY_MS);
const mondayOf = (day: string) => plusDays(day, -((new Date(dayMs(day)).getUTCDay() + 6) % 7));

function localDayReader(zone: string) {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  return (ms: number) => {
    const parts = Object.fromEntries(format.formatToParts(ms).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
}

const norm = (path: string) => path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
const lastSegment = (path: string) => path.replace(/\\/g, "/").replace(/\/+$/, "").split("/").pop() ?? path;
const mainRootOf = (repo: string) => repo.replace(/\/\.git\/?$/i, "");
// As `/v1/projects` names a project: the export key of its base checkout.
const keyOf = (root: string) => root.replace(/[^A-Za-z0-9]/g, "-");

// Every run once, the current one from the export's freshest copy.
function runsOf(file: SessionFile): ExportRun[] {
  const current = file.current;
  return current ? [...file.runs.filter((r) => r.id !== current.id), current] : file.runs;
}

// stats FR-08: a subagent counts with the latest main run started not after it; none: a free one.
function flowOf(run: ExportRun, mains: ExportRun[]): string {
  if (!run.agentId) return run.flow ?? "free";
  const at = Date.parse(run.since);
  const parent = mains.filter((m) => Date.parse(m.since) <= at).at(-1);
  return parent ? (parent.flow ?? "free") : "free";
}

// stats FR-04: what the session's totals hold beyond its runs', per kind and per model, never below zero.
function undatedOf(file: SessionFile, runs: ExportRun[]): Omit<Part, "day" | "projectId" | "sessionId" | "flow"> | null {
  const total = file.usage;
  if (!total) return null;
  const used = runs.flatMap((r) => (r.usage ? [r.usage] : []));
  const sumTokens = used.reduce((t, u) => add(t, u.tokens), zero());
  const tokens = Object.fromEntries(KINDS.map((k) => [k, Math.max(0, total.tokens[k] - sumTokens[k])])) as Tokens;
  const calls = Math.max(0, total.calls - used.reduce((n, u) => n + u.calls, 0));
  const byModel = total.byModel.flatMap((m) => {
    const runModels = used.flatMap((u) => u.byModel.filter((x) => x.model === m.model));
    const t = Object.fromEntries(KINDS.map((k) => [k, Math.max(0, m.tokens[k] - runModels.reduce((n, x) => n + x.tokens[k], 0))])) as Tokens;
    const c = Math.max(0, m.calls - runModels.reduce((n, x) => n + x.calls, 0));
    return c === 0 && totalOf(t) === 0 ? [] : [{ model: m.model, calls: c, tokens: t }];
  });
  return calls === 0 && totalOf(tokens) === 0 ? null : { calls, tokens, byModel };
}

interface Sum {
  calls: number;
  tokens: Tokens;
}
const emptySum = (): Sum => ({ calls: 0, tokens: zero() });
const addTo = (sum: Sum, calls: number, tokens: Tokens) => {
  sum.calls += calls;
  sum.tokens = add(sum.tokens, tokens);
};
const byTokens = <T extends Sum>(a: T, b: T) => totalOf(b.tokens) - totalOf(a.tokens);

export function createStatsService({ opsExport, questions, clock }: { opsExport: OpsExportReader; questions: { listWithTokens(): Promise<QuestionTokens[]> }; clock: Clock }) {
  return {
    async read({ period, project, tz }: StatsQuery): Promise<StatsResponse> {
      const { sessions, projects: projectFiles, imageRequestRunIds } = opsExport.read();
      const localDay = localDayReader(tz);
      const today = localDay(clock.now().getTime());

      // A session's project as the sessions list has it (`session` BR-05), named by its base checkout's key.
      const projectOf = (id: string) => {
        const main = mainRootOf(id);
        const file = projectFiles.find((p: ProjectFile) => norm(p.root) === norm(main));
        return keyOf(file?.root ?? main);
      };
      const nameOf = (key: string) => {
        const file = projectFiles.find((p) => keyOf(p.root) === key);
        return file?.manifest?.name ?? (file ? lastSegment(file.root) : null);
      };
      const names = new Map<string, string>();

      const parts: Part[] = [];
      for (const file of sessions) {
        const sessionProject = projectIdOf(file, projectFiles);
        const projectId = projectOf(sessionProject);
        if (!names.has(projectId)) names.set(projectId, nameOf(projectId) ?? lastSegment(mainRootOf(sessionProject)));
        const runs = runsOf(file);
        const mains = runs.filter((r) => !r.agentId).sort((a, b) => Date.parse(a.since) - Date.parse(b.since));
        for (const run of runs) {
          if (!run.usage) continue;
          const { calls, tokens, byModel } = run.usage;
          parts.push({ day: localDay(Date.parse(run.since)), projectId, sessionId: file.sessionId, flow: flowOf(run, mains), calls, tokens, byModel });
        }
        const undated = undatedOf(file, runs);
        if (undated) parts.push({ day: null, projectId, sessionId: file.sessionId, flow: "undated", ...undated });
      }
      for (const q of await questions.listWithTokens()) {
        if (!names.has(q.projectId)) names.set(q.projectId, nameOf(q.projectId) ?? q.projectId);
        parts.push({ day: localDay(q.askedAt.getTime()), projectId: q.projectId, sessionId: null, flow: "questions", calls: 0, tokens: q.tokens, byModel: q.model ? [{ model: q.model, calls: 0, tokens: q.tokens }] : [] });
      }

      // stats FR-02, FR-04: N days back from today; `all` from the oldest dated part, the undated ones with it.
      const dated = parts.flatMap((p) => (p.day !== null && p.day <= today ? [p.day] : []));
      const from = period === "all" ? ([...dated].sort()[0] ?? today) : plusDays(today, -(DAYS[period] - 1));
      const isWeekly = period === "all" && (dayMs(today) - dayMs(from)) / DAY_MS + 1 > MAX_DAY_BARS;
      const inPeriod = parts.filter((p) => (p.day === null ? period === "all" : p.day >= from && p.day <= today));
      const counted = project === undefined ? inPeriod : inPeriod.filter((p) => p.projectId === project);

      const bucketOf = (day: string) => (isWeekly ? mondayOf(day) : day);
      const first = bucketOf(from);
      const buckets = new Map<string, Sum>();
      for (let day = first; day <= today; day = plusDays(day, isWeekly ? 7 : 1)) buckets.set(day, emptySum());

      const totals = emptySum();
      const undated = emptySum();
      const projects = new Map<string, Sum & { sessions: Set<string> }>();
      const models = new Map<string, Sum>();
      const flows = new Map<string, Sum>();
      const bySession = new Map<string, Sum>();
      for (const p of counted) {
        addTo(totals, p.calls, p.tokens);
        if (p.day === null) addTo(undated, p.calls, p.tokens);
        else {
          const bucket = buckets.get(bucketOf(p.day));
          if (bucket) addTo(bucket, p.calls, p.tokens);
        }
        const proj = projects.get(p.projectId) ?? { ...emptySum(), sessions: new Set<string>() };
        addTo(proj, p.calls, p.tokens);
        if (p.sessionId) proj.sessions.add(p.sessionId);
        projects.set(p.projectId, proj);
        for (const m of p.byModel) {
          const model = models.get(m.model) ?? emptySum();
          addTo(model, m.calls, m.tokens);
          models.set(m.model, model);
        }
        const flow = flows.get(p.flow) ?? emptySum();
        addTo(flow, p.calls, p.tokens);
        flows.set(p.flow, flow);
        if (p.sessionId) {
          const session = bySession.get(p.sessionId) ?? emptySum();
          addTo(session, p.calls, p.tokens);
          bySession.set(p.sessionId, session);
        }
      }

      const nameFor = (id: string) => names.get(id) ?? id;
      const optionIds = [...new Set(inPeriod.map((p) => p.projectId))];
      const topSessions = [...bySession.entries()]
        .map(([id, sum]) => ({ id, ...sum }))
        .sort(byTokens)
        .slice(0, TOP_SESSIONS)
        .flatMap(({ id, calls, tokens }) => {
          const file = sessions.find((s) => s.sessionId === id);
          if (!file) return [];
          const current = file.current ?? file.runs.find((r) => !r.agentId) ?? null;
          const request = cleanRequest(current?.request ?? "");
          const projectId = projectOf(projectIdOf(file, projectFiles));
          return [
            {
              id,
              request: request.text,
              isRequestCut: request.isCut,
              isRequestImage: current !== null && imageRequestRunIds.has(current.id),
              projectId,
              projectName: nameFor(projectId),
              flow: current?.flow ?? "free",
              skill: current?.skill ?? null,
              mode: current?.mode ?? null,
              model: modelOf(file),
              calls,
              tokens,
              updatedAt: new Date(file.writtenAt).toISOString(),
            },
          ];
        });

      return {
        period,
        granularity: isWeekly ? "week" : "day",
        from: first,
        to: today,
        project: project === undefined ? null : { id: project, name: names.get(project) ?? nameOf(project) ?? project },
        totals: { ...totals, sessions: bySession.size, questions: counted.filter((p) => p.flow === "questions").length },
        undated: period === "all" && (undated.calls > 0 || totalOf(undated.tokens) > 0) ? undated : null,
        buckets: [...buckets.entries()].map(([start, sum]) => ({ start, ...sum })),
        projectOptions: optionIds.map((id) => ({ id, name: nameFor(id) })).sort((a, b) => a.name.localeCompare(b.name)),
        projects: [...projects.entries()].map(([id, { sessions: ids, ...sum }]) => ({ id, name: nameFor(id), sessions: ids.size, ...sum })).sort(byTokens),
        models: [...models.entries()].map(([model, sum]) => ({ model, ...sum })).sort(byTokens),
        flows: [...flows.entries()].map(([flow, sum]) => ({ flow, ...sum })).sort(byTokens),
        topSessions,
      };
    },
  };
}

export type StatsService = ReturnType<typeof createStatsService>;
