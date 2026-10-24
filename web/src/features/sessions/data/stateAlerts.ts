import { isOpen, type Session, type SessionState } from "./sessionView.ts";

// app FR-05: the state of each open session in a watched state, keyed by id, to compare one read with the next.
export const watchedStates = (sessions: Session[], watched: ReadonlySet<SessionState>): Map<string, SessionState> =>
  new Map(sessions.filter((s) => isOpen(s) && watched.has(s.state)).map((s) => [s.id, s.state]));

// The sessions that entered a watched state, or moved to another one, since `before`; none on the first read.
export function newlyWatched(before: Map<string, SessionState> | null, sessions: Session[], watched: ReadonlySet<SessionState>): Session[] {
  if (before === null) return [];
  return sessions.filter((s) => isOpen(s) && watched.has(s.state) && before.get(s.id) !== s.state);
}
