import { t } from "../../../shared/lib/i18n/index.ts";
import type { Session } from "../data/sessionView.ts";
import { age, stepText } from "./sessionText.ts";

// sessions-live FR-41: the current run's history as the export keeps it, oldest first (displayed newest first).

export type TrailEntry = Session["trail"][number];

export interface TrailLine {
  entry: TrailEntry;
  stepText: string | null;
  // Until the next line; null on the last, still running.
  durationText: string | null;
  // Square root of its seconds, the last line running until now: a few seconds stay visible beside an hour.
  weight: number;
  // A working line followed by another is finished: no badge, no pulse, its duration alone.
  isPastWork: boolean;
}

// Past about 1 h 47 a line, the last one most of all, weighs no more in the folded ribbon.
export const MAX_WEIGHT = 80;

const WAITS: ReadonlySet<TrailEntry["phase"]> = new Set(["awaiting-answer", "awaiting-commit"]);

const durationsOf = (trail: TrailEntry[]) =>
  trail.map((e, i) => {
    const next = trail[i + 1];
    return next ? Date.parse(next.at) - Date.parse(e.at) : null;
  });

const SKILL_LANES: Readonly<Record<string, string>> = { fastlane: "fastlane", blueprint: "blueprint", build: "blueprint", autopilot: "autopilot" };

// A line's skill in its lane's colour (sessions-live FR-29's tokens); neutral for the others.
export const skillColor = (skill: string | null): string | undefined =>
  skill && SKILL_LANES[skill] ? `var(--lane-${SKILL_LANES[skill]})` : undefined;

export const hasTrail =(s: Session) => !s.isOutsideSelo && s.trail.length > 0;

export function trailLines(trail: TrailEntry[], now: number): TrailLine[] {
  const durations = durationsOf(trail);
  return trail.map((entry, i) => {
    const ms = durations[i] ?? null;
    const lasted = Math.max(0, ms ?? now - Date.parse(entry.at));
    return { entry, stepText: stepText(entry), durationText: ms === null ? null : age(ms), weight: Math.min(MAX_WEIGHT, Math.sqrt(lasted / 1000)), isPastWork: ms !== null && entry.phase === "working" };
  });
}

// The ended waits on the person only: a wait still open counts once it ends.
export function waitingText(trail: TrailEntry[]): string | null {
  const durations = durationsOf(trail);
  const ms = trail.reduce((sum, e, i) => sum + (WAITS.has(e.phase) ? (durations[i] ?? 0) : 0), 0);
  return ms > 0 ? t("sessions.trail.waiting", { duration: age(ms) }) : null;
}
