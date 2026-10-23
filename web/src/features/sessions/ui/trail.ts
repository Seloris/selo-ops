import { t } from "../../../shared/lib/i18n/index.ts";
import type { Session } from "../data/sessionView.ts";
import { age, stepText } from "./sessionText.ts";

// sessions-live FR-41: the current run's history as the export keeps it, oldest first.

export type TrailEntry = Session["trail"][number];

export interface TrailLine {
  entry: TrailEntry;
  stepText: string | null;
  // Until the next line; null on the last, still running.
  durationText: string | null;
}

const WAITS: ReadonlySet<TrailEntry["phase"]> = new Set(["awaiting-answer", "awaiting-commit"]);

const durationsOf = (trail: TrailEntry[]) =>
  trail.map((e, i) => {
    const next = trail[i + 1];
    return next ? Date.parse(next.at) - Date.parse(e.at) : null;
  });

export const hasTrail = (s: Session) => !s.isOutsideSelo && s.trail.length > 0;

export function trailLines(trail: TrailEntry[]): TrailLine[] {
  const durations = durationsOf(trail);
  return trail.map((entry, i) => {
    const ms = durations[i] ?? null;
    return { entry, stepText: stepText(entry), durationText: ms === null ? null : age(ms) };
  });
}

// The ended waits on the person only: a wait still open counts once it ends.
export function waitingText(trail: TrailEntry[]): string | null {
  const durations = durationsOf(trail);
  const ms = trail.reduce((sum, e, i) => sum + (WAITS.has(e.phase) ? (durations[i] ?? 0) : 0), 0);
  return ms > 0 ? t("sessions.trail.waiting", { duration: age(ms) }) : null;
}
