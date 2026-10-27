import { describe, expect, it } from "vitest";
import { frenchDate, kindCounts, localDay, parseChangelog, parseEntry, relativeDay } from "./changelog.ts";

describe("parseEntry", () => {
  it("reads the three kinds", () => {
    // Act
    const kinds = ["Added — A.", "Changed — B.", "Fixed — C."].map((l) => parseEntry(l).kind);

    // Assert
    expect(kinds).toEqual(["added", "changed", "fixed"]);
  });

  it("reads the blueprint link as a path from the project's root, out of the text", () => {
    // Act
    const entry = parseEntry("Added — Tags on a todo. ([blueprint](blueprints/2026-01-02-tags.md))");

    // Assert
    expect(entry).toEqual({ kind: "added", label: null, text: "Tags on a todo.", blueprint: ".planning/blueprints/2026-01-02-tags.md" });
  });

  it("accepts a bold kind, an en dash, a hyphen or a colon, in any case", () => {
    // Act
    const entries = ["**Added** — A.", "fixed – B.", "Changed - C.", "ADDED: D."].map(parseEntry);

    // Assert
    expect(entries.map((e) => [e.kind, e.text])).toEqual([["added", "A."], ["fixed", "B."], ["changed", "C."], ["added", "D."]]);
  });

  it("keeps an unknown kind as a note with its word", () => {
    // Act
    const entry = parseEntry("Removed — The old export.");

    // Assert
    expect(entry).toEqual({ kind: "other", label: "Removed", text: "The old export.", blueprint: null });
  });

  it("keeps a line with no kind as a note, whole", () => {
    // Act
    const entry = parseEntry("Header moved to the top.");

    // Assert
    expect(entry).toEqual({ kind: "other", label: null, text: "Header moved to the top.", blueprint: null });
  });

  it("reads the kinds written in French, accented or not", () => {
    // Act
    const kinds = ["Ajouté — A.", "Modifié — B.", "Corrigé — C.", "CORRECTION : D.", "Ajoute — E."].map((l) => parseEntry(l).kind);

    // Assert
    expect(kinds).toEqual(["added", "changed", "fixed", "fixed", "added"]);
  });

  it("keeps a colon after an unknown word in the text", () => {
    // Act
    const entries = ["API: the export is faster.", "**Title:** text."].map(parseEntry);

    // Assert
    expect(entries.map((e) => [e.kind, e.label, e.text])).toEqual([
      ["other", null, "API: the export is faster."],
      ["other", null, "**Title:** text."],
    ]);
  });

  it("does not take a hyphenated word for a kind", () => {
    // Act
    const entry = parseEntry("Side-panel now opens wider.");

    // Assert
    expect(entry.kind).toBe("other");
    expect(entry.text).toBe("Side-panel now opens wider.");
  });
});

describe("parseChangelog", () => {
  it("reads the days newest first, their entries in order, the intro left out", () => {
    // Arrange
    const source = [
      "# Changelog",
      "",
      "What changed. Format: `- {Added|Changed|Fixed} — …`.",
      "- Not an entry: the intro.",
      "",
      "## 2026-10-27",
      "",
      "- Fixed — One.",
      "- Added — Two.",
      "",
      "## 2026-10-20",
      "",
      "- Changed — Three.",
    ].join("\r\n");

    // Act
    const days = parseChangelog(source);

    // Assert
    expect(days.map((d) => [d.date, d.entries.map((e) => e.text)])).toEqual([
      ["2026-10-27", ["One.", "Two."]],
      ["2026-10-20", ["Three."]],
    ]);
  });

  it("puts the newest day first when the file misplaces one, an undated heading on top", () => {
    // Act
    const days = parseChangelog("## 2026-10-20\n- Added — A.\n## 2026-10-27\n- Added — B.\n## Unreleased\n- Added — C.\n## 2026-10-24\n- Added — D.\n");

    // Assert
    expect(days.map((d) => d.heading)).toEqual(["Unreleased", "2026-10-27", "2026-10-24", "2026-10-20"]);
  });

  it("joins an entry's continuation lines", () => {
    // Act
    const days = parseChangelog("## 2026-10-27\n\n- Added — A long\n  entry on two lines.\n");

    // Assert
    expect(days[0]?.entries[0]?.text).toBe("A long entry on two lines.");
  });

  it("keeps a heading that is not a date, and drops a day with no entry", () => {
    // Act
    const days = parseChangelog("## Unreleased\n\n- Added — A.\n\n## 2026-02-30\n\n- Fixed — B.\n\n## 2026-01-01\n");

    // Assert
    expect(days.map((d) => [d.date, d.heading])).toEqual([
      [null, "Unreleased"],
      [null, "2026-02-30"],
    ]);
  });

  it("keeps a loose line under a day as a note", () => {
    // Act
    const days = parseChangelog("## 2026-10-27\n\nSomething happened.\n");

    // Assert
    expect(days[0]?.entries).toEqual([{ kind: "other", label: null, text: "Something happened.", blueprint: null }]);
  });

  it("reads nothing from an empty or headless file", () => {
    // Act / Assert
    expect(parseChangelog("")).toEqual([]);
    expect(parseChangelog("# Changelog\n\n- Added — Orphan.\n")).toEqual([]);
  });
});

describe("kindCounts", () => {
  it("counts each kind over every day", () => {
    // Arrange
    const days = parseChangelog("## 2026-10-27\n- Added — A.\n- Added — B.\n- Fixed — C.\n## 2026-10-26\n- Note.\n");

    // Act / Assert
    expect(kindCounts(days)).toEqual({ added: 2, changed: 0, fixed: 1, other: 1 });
  });
});

describe("dates", () => {
  it("names today and yesterday, across a month", () => {
    // Act / Assert
    expect(relativeDay("2026-11-01", "2026-11-01")).toBe("today");
    expect(relativeDay("2026-10-31", "2026-11-01")).toBe("yesterday");
    expect(relativeDay("2026-10-30", "2026-11-01")).toBeNull();
  });

  it("gives the local day of a timestamp", () => {
    // Act / Assert
    expect(localDay(new Date(2026, 0, 5, 23, 30).getTime())).toBe("2026-01-05");
  });

  it("writes a date in French", () => {
    // Act / Assert
    expect(frenchDate("2026-10-27")).toBe("27 octobre 2026");
    expect(frenchDate("2026-10-01")).toBe("1er octobre 2026");
  });
});
