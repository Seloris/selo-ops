import { describe, expect, it } from "vitest";
import { parseFlags, toggleFlag, toggleNotify } from "./flags.ts";

describe("session flags", () => {
  it("flags then unflags a session", () => {
    const flagged = toggleFlag({ flagged: [], notify: [] }, "a");
    expect(flagged).toEqual({ flagged: ["a"], notify: [] });
    expect(toggleFlag(flagged, "a")).toEqual({ flagged: [], notify: [] });
  });

  it("notifies only for a flagged session", () => {
    expect(toggleNotify({ flagged: [], notify: [] }, "a")).toEqual({ flagged: [], notify: [] });
    expect(toggleNotify({ flagged: ["a"], notify: [] }, "a")).toEqual({ flagged: ["a"], notify: ["a"] });
    expect(toggleNotify({ flagged: ["a"], notify: ["a"] }, "a")).toEqual({ flagged: ["a"], notify: [] });
  });

  it("stops the notifications when unflagged", () => {
    expect(toggleFlag({ flagged: ["a", "b"], notify: ["a", "b"] }, "a")).toEqual({ flagged: ["b"], notify: ["b"] });
  });

  it("reads a stored value defensively", () => {
    expect(parseFlags(null)).toEqual({ flagged: [], notify: [] });
    expect(parseFlags("x")).toEqual({ flagged: [], notify: [] });
    expect(parseFlags({ flagged: ["a", 3], notify: ["a", "b"] })).toEqual({ flagged: ["a"], notify: ["a"] });
  });
});
