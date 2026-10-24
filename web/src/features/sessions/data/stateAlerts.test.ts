import { describe, expect, it } from "vitest";
import type { Session } from "./sessionView.ts";
import { newlyWatched, watchedBy, watchedStates } from "./stateAlerts.ts";

const session = (id: string, state: Session["state"], patch: Partial<Session> = {}) =>
  ({ id, state, isClosed: false, isArchived: false, ...patch }) as Session;
const todo = watchedBy(new Set(["awaiting-answer", "awaiting-permission", "awaiting-commit", "stopped"]), new Set());
const ids = (list: Session[]) => list.map((s) => s.id);

describe("newlyWatched", () => {
  it("raises nothing on the first read", () => {
    expect(newlyWatched(null, [session("a", "awaiting-answer")], todo)).toEqual([]);
  });

  it("raises a session that enters a watched state", () => {
    const before = watchedStates([session("a", "working"), session("b", "awaiting-commit")], todo);
    expect(ids(newlyWatched(before, [session("a", "awaiting-permission"), session("b", "awaiting-commit")], todo))).toEqual(["a"]);
  });

  it("raises a session that moves to another watched state", () => {
    const before = watchedStates([session("a", "awaiting-answer")], todo);
    expect(ids(newlyWatched(before, [session("a", "awaiting-commit")], todo))).toEqual(["a"]);
  });

  it("raises a new session already in a watched state", () => {
    expect(ids(newlyWatched(watchedStates([], todo), [session("a", "stopped")], todo))).toEqual(["a"]);
  });

  it("watches only the chosen states", () => {
    const done = watchedBy(new Set(["job-done"]), new Set());
    const before = watchedStates([session("a", "working"), session("b", "working")], done);
    expect(ids(newlyWatched(before, [session("a", "job-done"), session("b", "awaiting-answer")], done))).toEqual(["a"]);
  });

  it("ignores closed and archived sessions", () => {
    const now = [session("a", "awaiting-answer", { isClosed: true }), session("b", "stopped", { isArchived: true })];
    expect(newlyWatched(watchedStates([], todo), now, todo)).toEqual([]);
  });

  it("raises a flagged session with its switch on at the end of a turn or of its job only", () => {
    const flagged = watchedBy(new Set(), new Set(["a", "b", "c"]));
    const before = watchedStates([session("a", "working"), session("b", "working"), session("c", "working"), session("d", "working")], flagged);
    const now = [session("a", "turn-ended"), session("b", "job-done"), session("c", "awaiting-answer"), session("d", "job-done")];
    expect(ids(newlyWatched(before, now, flagged))).toEqual(["a", "b"]);
  });

  it("raises a session once when the bell and its switch both watch its state", () => {
    const both = watchedBy(new Set(["job-done"]), new Set(["a"]));
    expect(ids(newlyWatched(watchedStates([session("a", "working")], both), [session("a", "job-done")], both))).toEqual(["a"]);
  });
});
