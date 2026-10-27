import { describe, expect, it } from "vitest";
import { fileTotals } from "./fileTotals.ts";

describe("fileTotals", () => {
  it("sums the lines and counts the files with an uncommitted part", () => {
    // Act
    const totals = fileTotals([
      { added: 6, removed: 2, isUncommitted: false },
      { added: 27, removed: 7, isUncommitted: true },
      { added: null, removed: null, isUncommitted: true },
    ]);

    // Assert
    expect(totals).toEqual({ added: 33, removed: 9, uncommitted: 2 });
  });

  it("gives zeros for no file", () => {
    expect(fileTotals([])).toEqual({ added: 0, removed: 0, uncommitted: 0 });
  });
});
