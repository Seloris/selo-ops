import { describe, expect, it } from "vitest";
import type { Session } from "./sessionView.ts";
import { newlyWatched, watchedStates } from "./stateAlerts.ts";

const session = (id: string, state: Session["state"], patch: Partial<Session> = {}) =>
  ({ id, state, isClosed: false, isArchived: false, ...patch }) as Session;
const todo = new Set<Session["state"]>(["awaiting-answer", "awaiting-permission", "awaiting-commit", "stopped"]);
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
    const done = new Set<Session["state"]>(["job-done"]);
    const before = watchedStates([session("a", "working"), session("b", "working")], done);
    expect(ids(newlyWatched(before, [session("a", "job-done"), session("b", "awaiting-answer")], done))).toEqual(["a"]);
  });

  it("ignores closed and archived sessions", () => {
    const now = [session("a", "awaiting-answer", { isClosed: true }), session("b", "stopped", { isArchived: true })];
    expect(newlyWatched(watchedStates([], todo), now, todo)).toEqual([]);
  });
});
