import { t } from "../../../shared/lib/i18n/index.ts";
import type { Session } from "../data/sessionView.ts";
import { age, LOOP_SUBSTEPS, stepText } from "./sessionText.ts";

// sessions-live FR-41: the current run's history as the export keeps it, oldest first (displayed newest first).

export type TrailEntry = Session["trail"][number];

export interface TrailLine {
  entry: TrailEntry;
  stepText: string | null;
  // Until the next line; null on the last, still running.
  durationText: string | null;
  // Square root of its seconds, the last line running until now: a few seconds stay visible beside an hour.
  weight: number;
  // A working line followed by another is finished: no badge, no pulse.
  isPastWork: boolean;
  // A line of a fastlane's iterate loop, before its end's first mark past `code` (`session` BR-22).
  isLoop: boolean;
}

// Past about 1 h 47 a line, the last one most of all, weighs no more in the folded ribbon.
export const MAX_WEIGHT = 80;

const WAITS: ReadonlySet<TrailEntry["phase"]> = new Set(["awaiting-answer", "awaiting-commit"]);

const durationsOf = (trail: TrailEntry[]) =>
  trail.map((e, i) => {
    const next = trail[i + 1];
    return next ? Date.parse(next.at) - Date.parse(e.at) : null;
  });

const SKILL_LANES: Readonly<Record<string, string>> = { fastlane: "fastlane", blueprint: "blueprint", build: "blueprint", pilot: "pilot", mockup: "mockup" };

// A line's skill in its lane's colour, mockup in its flow's (sessions-live FR-29's tokens); neutral for the others.
export const skillColor = (skill: string | null): string | undefined =>
  skill && SKILL_LANES[skill] ? `var(--lane-${SKILL_LANES[skill]})` : undefined;

// The line's skill colour: orange through an iterate loop, else its skill's.
export const lineColor = (l: TrailLine): string | undefined => (l.isLoop ? "var(--lane-iterate)" : skillColor(l.entry.skill));

export const hasTrail =(s: Session) => !s.isOutsideSelo && s.trail.length > 0;

const weightOf = (ms: number) => Math.min(MAX_WEIGHT, Math.sqrt(Math.max(0, ms) / 1000));

export function trailLines(trail: TrailEntry[], now: number, mode: string | null = null): TrailLine[] {
  const durations = durationsOf(trail);
  const loopEnd = mode === "iterate" ? trail.findIndex((e) => !LOOP_SUBSTEPS.has(e.substep)) : 0;
  return trail.map((entry, i) => {
    const ms = durations[i] ?? null;
    return { entry, stepText: stepText(entry), durationText: ms === null ? null : age(ms), weight: weightOf(ms ?? now - Date.parse(entry.at)), isPastWork: ms !== null && entry.phase === "working", isLoop: loopEnd === -1 || i < loopEnd };
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

export interface TrailGroup<L extends TrailLine = TrailLine> {
  // Its first line's, the run's opening line with no skill included.
  at: string;
  // Every line it stands for, oldest first: the rail toward it takes their colours.
  lines: L[];
  // Its passages, oldest first: the opening line with no skill left out when it joined a labelled group.
  passages: L[];
  // How long each passage lasted; the last one until now while the run goes on, none once it ended.
  passageDurations: (string | null)[];
  // No skill and no step on any line: a request with no skill.
  isFree: boolean;
  // Its subagents, started while it ran, newest first.
  agents: AgentLine[];
  // Until the next group, the last one until now while the run goes on, until its last line once ended.
  durationText: string;
  // Until the next group; null on the last.
  gapText: string | null;
  // Square root of its span: the rail toward it, from the newer group.
  weight: number;
}

const agentLine = (agent: Subagent, now: number): AgentLine => {
  const [, lead = "", skill = "", rest = ""] = /^(.*?·\s*)(\S+)(.*)$/.exec(agent.task ?? "") ?? [];
  return {
    agent,
    label: agent.task ?? agent.type,
    parts: skill ? { lead, skill, rest } : null,
    durationText: age(Math.max(0, (agent.state === "working" ? now : Date.parse(agent.updatedAt)) - Date.parse(agent.since))),
  };
};

// The run stops running at these: a group ending on one lasts until it.
const ENDS: ReadonlySet<TrailEntry["phase"]> = new Set(["turn-ended", "job-done", "stopped"]);

const isBare = (l: TrailLine) => !l.entry.skill && !l.entry.step && !l.entry.substep;
const labelOf = (l: TrailLine) => [l.entry.skill, l.entry.step, l.entry.substep, l.isLoop].join("|");

// sessions-live FR-53: consecutive lines of the same label as one group, each subagent under the group running when it started.
// A closed or archived session runs no more, whatever its last line says.
export function trailGroups<L extends TrailLine>(lines: L[], agents: Subagent[], now: number, isSessionOver = false): TrailGroup<L>[] {
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
  const lastLine = lines[lines.length - 1];
  const endOfRun = lastLine && (isSessionOver || ENDS.has(lastLine.entry.phase)) ? Date.parse(lastLine.entry.at) : now;
  return groups.map((group, gi) => {
    const passages = openingJoins && gi === 0 ? group.slice(1) : group;
    const start = starts[gi] as number;
    const until = starts[gi + 1];
    const lastIndex = passages.length - 1;
    return {
      at: (group[0] as L).entry.at,
      lines: group,
      passages,
      passageDurations: passages.map((l, i) => l.durationText ?? (until === undefined && i === lastIndex && endOfRun === now ? age(now - Date.parse(l.entry.at)) : null)),
      isFree: group.every(isBare),
      agents: agents
        .filter((a) => {
          const since = Date.parse(a.since);
          return (gi === 0 || since >= start) && (until === undefined || since < until);
        })
        .sort((a, b) => Date.parse(b.since) - Date.parse(a.since))
        .map((a) => agentLine(a, now)),
      durationText: age((until ?? endOfRun) - start),
      gapText: until === undefined ? null : age(until - start),
      weight: weightOf((until ?? now) - start),
    };
  });
}

// The ended waits on the person only: a wait still open counts once it ends.
export function waitingText(trail: TrailEntry[]): string | null {
  const durations = durationsOf(trail);
  const ms = trail.reduce((sum, e, i) => sum + (WAITS.has(e.phase) ? (durations[i] ?? 0) : 0), 0);
  return ms > 0 ? t("sessions.trail.waiting", { duration: age(ms) }) : null;
}
