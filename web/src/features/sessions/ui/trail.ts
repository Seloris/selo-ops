import { t } from "../../../shared/lib/i18n/index.ts";
import type { Session } from "../data/sessionView.ts";
import { age, LOOP_SUBSTEPS, stepText } from "./sessionText.ts";

// sessions-live FR-41: each prompt's history as the export keeps it, oldest first, read as chapters (FR-53).

export type TrailEntry = Session["trail"][number];

export interface TrailLine {
  entry: TrailEntry;
  stepText: string | null;
  // Until the next line; null on the last, still running.
  durationMs: number | null;
  durationText: string | null;
  // A working line followed by another is finished: no badge, no pulse.
  isPastWork: boolean;
  // A line of a fastlane's iterate loop, before its end's first mark past `code` (`session` BR-22).
  isLoop: boolean;
}

const WAITS: ReadonlySet<TrailEntry["phase"]> = new Set(["awaiting-answer", "awaiting-commit"]);

const durationsOf = (trail: TrailEntry[]) =>
  trail.map((e, i) => {
    const next = trail[i + 1];
    return next ? Date.parse(next.at) - Date.parse(e.at) : null;
  });

// A span under an hour reads to the second (« 1 min 40 », « 30 s »), a longer one as an age.
export function spanText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const rest = s % 60;
  return s < 60 || s >= 3600 || rest === 0 ? age(ms) : `${age(ms)} ${String(rest).padStart(2, "0")}`;
}

const SKILL_LANES: Readonly<Record<string, string>> = { fastlane: "fastlane", blueprint: "blueprint", build: "blueprint", pilot: "pilot", mockup: "mockup" };

// A line's skill in its lane's colour, mockup in its flow's (sessions-live FR-29's tokens); neutral for the others.
export const skillColor = (skill: string | null): string | undefined =>
  skill && SKILL_LANES[skill] ? `var(--lane-${SKILL_LANES[skill]})` : undefined;

// The line's skill colour: orange through an iterate loop, else its skill's.
export const lineColor = (l: TrailLine): string | undefined => (l.isLoop ? "var(--lane-iterate)" : skillColor(l.entry.skill));

export const hasTrail = (s: Session) => !s.isOutsideSelo && s.trail.length > 0;

export type TrailRun = Session["runs"][number];

// sessions-live FR-41: the session's earlier prompts that kept a history, oldest first; the current one is the session's own.
// The current prompt's start: its run's, else its first line kept.
export const currentRunSince = (s: Pick<Session, "runs" | "trail">): string | null => s.runs.find((r) => r.isCurrent)?.since ?? s.trail[0]?.at ?? null;

export const earlierRuns = (s: Pick<Session, "isOutsideSelo" | "runs">): TrailRun[] => (s.isOutsideSelo ? [] : s.runs.filter((r) => !r.isCurrent && r.trail.length > 0));

export function trailLines(trail: TrailEntry[], mode: string | null = null): TrailLine[] {
  const durations = durationsOf(trail);
  const loopEnd = mode === "iterate" ? trail.findIndex((e) => !LOOP_SUBSTEPS.has(e.substep)) : 0;
  return trail.map((entry, i) => {
    const ms = durations[i] ?? null;
    return { entry, stepText: stepText(entry), durationMs: ms, durationText: ms === null ? null : spanText(ms), isPastWork: ms !== null && entry.phase === "working", isLoop: loopEnd === -1 || i < loopEnd };
  });
}

export type Subagent = Session["subagents"][number];

export interface AgentLine {
  agent: Subagent;
  label: string;
  // Its task cut around the word after « · » (« planner · », « blueprint », « due-date »): the step a pilot gave it.
  parts: { lead: string; skill: string; rest: string } | null;
  // Until the export last saw it, until now while it works.
  durationText: string;
}

const agentLine = (agent: Subagent, now: number): AgentLine => {
  const [, lead = "", skill = "", rest = ""] = /^(.*?·\s*)(\S+)(.*)$/.exec(agent.task ?? "") ?? [];
  return {
    agent,
    label: agent.task ?? agent.type,
    parts: skill ? { lead, skill, rest } : null,
    durationText: spanText(Math.max(0, (agent.state === "working" ? now : Date.parse(agent.updatedAt)) - Date.parse(agent.since))),
  };
};

export type ChapterItem<L extends TrailLine = TrailLine> = { kind: "passage"; at: string; line: L; durationText: string | null } | { kind: "agent"; at: string; agent: AgentLine };

export interface Chapter<L extends TrailLine = TrailLine> {
  // Its first line's, the run's opening line with no skill included.
  at: string;
  // Every line it stands for, oldest first.
  lines: L[];
  // Its passages, oldest first: the opening line with no skill left out when it joined a labelled chapter.
  passages: L[];
  // No skill and no step on any line: a request with no skill.
  isFree: boolean;
  // Its subagents, started while it ran, oldest first.
  agents: AgentLine[];
  // Its passages and subagents by time, oldest first; a passage's duration lasts until now while the run goes on.
  items: ChapterItem<L>[];
  // Until the next chapter, the last one until now while the run goes on, until its last line once ended.
  durationText: string;
  // Its ended waits on the person (« 2 min à t'attendre »), none without.
  waitingText: string | null;
  // Its lines « Attend ta réponse »: the back-and-forths with the person.
  roundTrips: number;
  // The chapter in progress: the last one, its last line working, while the run goes on.
  isLive: boolean;
}

export interface Trail<L extends TrailLine = TrailLine> {
  chapters: Chapter<L>[];
  // The run still goes on: its last line is not an end and the session is open.
  isRunning: boolean;
  // From the first kept line to the end of the run, or to now; null with no line.
  durationText: string | null;
  waitingText: string | null;
}

// The run stops running at these: a chapter ending on one lasts until it.
const ENDS: ReadonlySet<TrailEntry["phase"]> = new Set(["turn-ended", "job-done", "stopped"]);

const isBare = (l: TrailLine) => !l.entry.skill && !l.entry.step && !l.entry.substep;
const labelOf = (l: TrailLine) => [l.entry.skill, l.entry.step, l.isLoop].join("|");

const waitingOf = (ms: number) => (ms > 0 ? t("sessions.trail.waiting", { duration: spanText(ms) }) : null);
const waitingMs = (lines: TrailLine[]) => lines.reduce((sum, l) => sum + (WAITS.has(l.entry.phase) ? (l.durationMs ?? 0) : 0), 0);

// sessions-live FR-53: consecutive lines of the same skill and step as one chapter, each subagent under the chapter
// running when it started. A closed or archived session runs no more, whatever its last line says.
export function trailChapters<L extends TrailLine>(lines: L[], agents: Subagent[], now: number, isSessionOver = false): Trail<L> {
  const runs: L[][] = [];
  for (const line of lines) {
    const current = runs[runs.length - 1];
    if (current && labelOf(current[current.length - 1] as L) === labelOf(line)) current.push(line);
    else runs.push([line]);
  }
  // The run's opening line with no skill (the request, before its skill's first mark) belongs to what follows.
  const [opening, next] = runs;
  const openingJoins = opening?.length === 1 && next && isBare(opening[0] as L) && !isBare(next[0] as L);
  const groups = openingJoins ? [[...opening, ...next], ...runs.slice(2)] : runs;
  const starts = groups.map((g) => Date.parse((g[0] as L).entry.at));
  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];
  const isRunning = lastLine !== undefined && !isSessionOver && !ENDS.has(lastLine.entry.phase);
  const endOfRun = lastLine && !isRunning ? Date.parse(lastLine.entry.at) : now;
  const chapters = groups.map((group, gi): Chapter<L> => {
    const passages = openingJoins && gi === 0 ? group.slice(1) : group;
    const start = starts[gi] as number;
    const until = starts[gi + 1];
    const lastIndex = passages.length - 1;
    const last = group[group.length - 1] as L;
    const chapterAgents = agents
      .filter((a) => {
        const since = Date.parse(a.since);
        return (gi === 0 || since >= start) && (until === undefined || since < until);
      })
      .sort((a, b) => Date.parse(a.since) - Date.parse(b.since))
      .map((a) => agentLine(a, now));
    const items: ChapterItem<L>[] = [
      ...passages.map((l, i): ChapterItem<L> => ({ kind: "passage", at: l.entry.at, line: l, durationText: l.durationText ?? (until === undefined && i === lastIndex && isRunning ? spanText(now - Date.parse(l.entry.at)) : null) })),
      ...chapterAgents.map((a): ChapterItem<L> => ({ kind: "agent", at: a.agent.since, agent: a })),
    ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    return {
      at: (group[0] as L).entry.at,
      lines: group,
      passages,
      isFree: group.every(isBare),
      agents: chapterAgents,
      items,
      durationText: spanText((until ?? endOfRun) - start),
      waitingText: waitingOf(waitingMs(group)),
      roundTrips: group.filter((l) => l.entry.phase === "awaiting-answer").length,
      isLive: until === undefined && isRunning && last.entry.phase === "working",
    };
  });
  return {
    chapters,
    isRunning,
    durationText: firstLine ? spanText(endOfRun - Date.parse(firstLine.entry.at)) : null,
    waitingText: waitingOf(waitingMs(lines)),
  };
}

export interface PathStep {
  label: string;
  color: string | undefined;
}

// Folded, the chapters' skills in their lane's colour, consecutive chapters of the same skill once.
export function trailPath<L extends TrailLine>(chapters: Chapter<L>[]): PathStep[] {
  const steps: PathStep[] = [];
  for (const c of chapters) {
    const last = c.lines[c.lines.length - 1] as L;
    const step: PathStep = c.isFree ? { label: t("sessions.lane.free"), color: "var(--lane-free)" } : { label: last.entry.skill ?? last.stepText ?? "", color: lineColor(last) };
    const prev = steps[steps.length - 1];
    if (!prev || prev.label !== step.label || prev.color !== step.color) steps.push(step);
  }
  return steps;
}
