import { describe, expect, it } from "vitest";
import { MIN_LIST_WIDTH, MIN_PANEL_WIDTH, clampPanelWidth, parsePanelWidth } from "./panelWidth.ts";

describe("clampPanelWidth", () => {
  it("keeps a width that leaves room for both sides", () => {
    expect(clampPanelWidth(600, 1600)).toBe(600);
  });

  it("never goes below the detail's minimum", () => {
    expect(clampPanelWidth(100, 1600)).toBe(MIN_PANEL_WIDTH);
  });

  it("leaves the list its minimum", () => {
    expect(clampPanelWidth(1500, 1600)).toBe(1600 - MIN_LIST_WIDTH);
  });

  it("prefers the detail's minimum when the window is too narrow for both", () => {
    expect(clampPanelWidth(500, 700)).toBe(MIN_PANEL_WIDTH);
  });

  it("rounds to whole pixels", () => {
    expect(clampPanelWidth(612.6, 1600)).toBe(613);
  });
});

describe("parsePanelWidth", () => {
  it("reads a stored number", () => {
    expect(parsePanelWidth(640)).toBe(640);
  });

  it("drops anything else", () => {
    expect(parsePanelWidth("640")).toBeNull();
    expect(parsePanelWidth(Number.NaN)).toBeNull();
    expect(parsePanelWidth(undefined)).toBeNull();
    expect(parsePanelWidth(-5)).toBeNull();
  });
});
