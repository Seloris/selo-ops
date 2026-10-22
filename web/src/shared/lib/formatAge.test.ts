import { describe, expect, it } from "vitest";
import { formatAge } from "./formatAge.ts";

const units = { s: "s", min: "min", h: "h", d: "j" };

describe("formatAge", () => {
  it.each([
    [0, "0 s"],
    [59_999, "59 s"],
    [60_000, "1 min"],
    [59 * 60_000 + 59_000, "59 min"],
    [3_600_000, "1 h"],
    [3_600_000 + 5 * 60_000, "1 h 05"],
    [2 * 3_600_000 + 45 * 60_000, "2 h 45"],
    [86_400_000 * 3 + 3_600_000, "3 j"],
    [-5_000, "0 s"],
  ])("formats %i ms as « %s »", (ms, expected) => {
    // Act
    const text = formatAge(ms, units);

    // Assert
    expect(text).toBe(expected);
  });
});
