import { describe, expect, it } from "vitest";
import { t, tn } from "./index.ts";

describe("t", () => {
  it("fills the named variables", () => {
    // Act, Assert
    expect(t("sessions.subtitle.todo", { count: 3 })).toBe("3 à traiter");
  });
});

describe("tn", () => {
  it.each([
    [0, "0 session ouverte"],
    [1, "1 session ouverte"],
    [2, "2 sessions ouvertes"],
  ])("takes the French singular for 0 and 1: %i", (count, expected) => {
    // Act, Assert
    expect(tn("sessions.subtitle.open", count)).toBe(expected);
  });
});
