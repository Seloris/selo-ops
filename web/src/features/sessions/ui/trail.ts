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

export function trailLines(trail: TrailEntry[], now: number, mode: string | null = null): TrailLine[] {
  const durations = durationsOf(trail);
  const loopEnd = mode === "iterate" ? trail.findIndex((e) => !LOOP_SUBSTEPS.has(e.substep)) : 0;
  return trail.map((entry, i) => {
    const ms = durations[i] ?? null;
    const lasted = Math.max(0, ms ?? now - Date.parse(entry.at));
    return { entry, stepText: stepText(entry), durationText: ms === null ? null : age(ms), weight: Math.min(MAX_WEIGHT, Math.sqrt(lasted / 1000)), isPastWork: ms !== null && entry.phase === "working", isLoop: loopEnd === -1 || i < loopEnd };
  });
}

// The ended waits on the person only: a wait still open counts once it ends.
export function waitingText(trail: TrailEntry[]): string | null {
  const durations = durationsOf(trail);
  const ms = trail.reduce((sum, e, i) => sum + (WAITS.has(e.phase) ? (durations[i] ?? 0) : 0), 0);
  return ms > 0 ? t("sessions.trail.waiting", { duration: age(ms) }) : null;
}
