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

export interface TimelineItem<L extends TrailLine = TrailLine> {
  at: string;
  line: L | null;
  agent: AgentLine | null;
  state: TrailEntry["phase"];
  // The run's line in force until the next item: the rail between them takes its colour.
  runLine: L | null;
  // Until the next item; null on the last.
  gapText: string | null;
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

// sessions-live FR-41: the run's lines and its subagents, oldest first, each subagent at its start.
export function timelineItems<L extends TrailLine>(lines: L[], agents: Subagent[], now: number): TimelineItem<L>[] {
  // A stable sort keeps a run line before a subagent started at the same time.
  const items = [
    ...lines.map((line) => ({ at: line.entry.at, line, agent: null, state: line.entry.phase })),
    ...agents.map((a) => ({ at: a.since, line: null, agent: agentLine(a, now), state: a.state })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let runLine: L | null = null;
  return items.map((item, i) => {
    runLine = item.line ?? runLine;
    const next = items[i + 1];
    const ms = next ? Date.parse(next.at) - Date.parse(item.at) : null;
    return { ...item, runLine, gapText: ms === null ? null : age(ms), weight: weightOf(ms ?? now - Date.parse(item.at)) };
  });
}

// The ended waits on the person only: a wait still open counts once it ends.
export function waitingText(trail: TrailEntry[]): string | null {
  const durations = durationsOf(trail);
  const ms = trail.reduce((sum, e, i) => sum + (WAITS.has(e.phase) ? (durations[i] ?? 0) : 0), 0);
  return ms > 0 ? t("sessions.trail.waiting", { duration: age(ms) }) : null;
}
