import { describe, expect, it } from "vitest";
import { parseFoldedSections, toggleSection } from "./detailSections.ts";

describe("parseFoldedSections", () => {
  it("keeps the known sections, once each", () => {
    expect(parseFoldedSections(["files", "agents", "files"])).toEqual(["files", "agents"]);
  });

  it("keeps the usage sections", () => {
    expect(parseFoldedSections(["runUsage", "usage"])).toEqual(["runUsage", "usage"]);
  });

  it("drops what is not a known section", () => {
    expect(parseFoldedSections(["files", "nope", 3, null])).toEqual(["files"]);
  });

  it("reads anything but a list as no folded section", () => {
    expect(parseFoldedSections(null)).toEqual([]);
    expect(parseFoldedSections("files")).toEqual([]);
    expect(parseFoldedSections({ files: true })).toEqual([]);
  });
});

describe("toggleSection", () => {
  it("folds an open section", () => {
    expect(toggleSection(["files"], "agents")).toEqual(["files", "agents"]);
  });

  it("opens a folded section", () => {
    expect(toggleSection(["files", "agents"], "files")).toEqual(["agents"]);
  });
});
