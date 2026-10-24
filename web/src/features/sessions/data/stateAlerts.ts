import { isOpen, type Session, type SessionState } from "./sessionView.ts";

// app FR-05, FR-07: whether a session's state notifies, from the bell's states or the session's own switch.
export type IsWatched = (session: Session) => boolean;

// sessions-live FR-42: a flagged session with its switch on notifies at the end of a turn or of its job.
export const FLAG_STATES: ReadonlySet<SessionState> = new Set(["turn-ended", "job-done"]);

export const watchedBy =
  (states: ReadonlySet<SessionState>, notifyIds: ReadonlySet<string>): IsWatched =>
  (s) =>
    states.has(s.state) || (notifyIds.has(s.id) && FLAG_STATES.has(s.state));

// The state of each open session in a watched state, keyed by id, to compare one read with the next.
export const watchedStates = (sessions: Session[], isWatched: IsWatched): Map<string, SessionState> =>
  new Map(sessions.filter((s) => isOpen(s) && isWatched(s)).map((s) => [s.id, s.state]));

// The sessions that entered a watched state, or moved to another one, since `before`; none on the first read.
export function newlyWatched(before: Map<string, SessionState> | null, sessions: Session[], isWatched: IsWatched): Session[] {
  if (before === null) return [];
  return sessions.filter((s) => isOpen(s) && isWatched(s) && before.get(s.id) !== s.state);
}
