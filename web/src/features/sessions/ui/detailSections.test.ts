import { describe, expect, it } from "vitest";
import { parseFoldedSections, toggleSection } from "./detailSections.ts";

const DEFAULTS = { panel: ["files", "usage", "agents", "settings"], fullscreen: [] };

describe("parseFoldedSections", () => {
  it("keeps the known sections of each layout, once each", () => {
    expect(parseFoldedSections({ panel: ["files", "agents", "files"], fullscreen: ["usage"] })).toEqual({ panel: ["files", "agents"], fullscreen: ["usage"] });
  });

  it("drops what is not a known section", () => {
    expect(parseFoldedSections({ panel: ["files", "nope", 3, null], fullscreen: [] }).panel).toEqual(["files"]);
  });

  it("folds the technical sections of the panel and nothing in full screen by default", () => {
    expect(parseFoldedSections(undefined)).toEqual(DEFAULTS);
    expect(parseFoldedSections("files")).toEqual(DEFAULTS);
  });

  it("reads the former single list as the defaults", () => {
    expect(parseFoldedSections(["recap", "close"])).toEqual(DEFAULTS);
  });

  it("keeps an empty list as nothing folded, and defaults a missing layout", () => {
    expect(parseFoldedSections({ panel: [] })).toEqual({ panel: [], fullscreen: [] });
    expect(parseFoldedSections({ fullscreen: ["usage"] })).toEqual({ panel: DEFAULTS.panel, fullscreen: ["usage"] });
  });
});

describe("toggleSection", () => {
  const folded = { panel: ["files" as const], fullscreen: [] };

  it("folds an open section of one layout only", () => {
    expect(toggleSection(folded, "panel", "agents")).toEqual({ panel: ["files", "agents"], fullscreen: [] });
    expect(toggleSection(folded, "fullscreen", "agents")).toEqual({ panel: ["files"], fullscreen: ["agents"] });
  });

  it("opens a folded section", () => {
    expect(toggleSection(folded, "panel", "files")).toEqual({ panel: [], fullscreen: [] });
  });
});
