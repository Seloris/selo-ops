import { describe, expect, it } from "vitest";
import { answer, isAnswered, isPreviewAllowed, isScopeOpen, laneFor, previewHint, splitPrompt, type Answers } from "./laneChooser.ts";

const prompts = (answers: Answers) => laneFor(answers)?.prompts.map((prompt) => prompt.command);

describe("laneFor", () => {
  it("waits for the three answers", () => {
    expect(laneFor({})).toBeNull();
    expect(laneFor({ stay: "stay", scope: "page" })).toBeNull();
    expect(laneFor({ stay: "stay", preview: "direct" })).toBeNull();
  });

  it("needs no scope once the person leaves", () => {
    expect(laneFor({ stay: "leave", preview: "direct" })?.lane).toBe("pilot");
  });

  it("gives the fastlane for one page or component", () => {
    expect(prompts({ stay: "stay", scope: "page", preview: "direct" })).toEqual(["/selo-flow:fastlane {demande}"]);
    expect(prompts({ stay: "stay", scope: "page", preview: "iterate" })).toEqual(["/selo-flow:fastlane {demande} --iterate"]);
    expect(prompts({ stay: "stay", scope: "page", preview: "mockup" })).toEqual(["/selo-flow:mockup {demande}", "/selo-flow:fastlane {demande} --mockup .planning/mockups/{fichier}"]);
  });

  it("gives the blueprint then build for a new page, entity or rule", () => {
    expect(prompts({ stay: "stay", scope: "new", preview: "direct" })).toEqual(["/selo-flow:blueprint {demande}", "/selo-flow:build {blueprint}"]);
    expect(prompts({ stay: "stay", scope: "new", preview: "mockup" })).toEqual(["/selo-flow:mockup {demande}", "/selo-flow:blueprint {demande} --mockup .planning/mockups/{fichier}", "/selo-flow:build {blueprint}"]);
  });

  it("gives the autonomous pilot when the person leaves, with a mockup drawn first", () => {
    expect(prompts({ stay: "leave", scope: "new", preview: "direct" })).toEqual(["/selo-flow:pilot {demande} --autonomous"]);
    expect(prompts({ stay: "leave", preview: "mockup" })).toEqual(["/selo-flow:mockup {demande}", "/selo-flow:pilot {demande} --mockup .planning/mockups/{fichier} --autonomous"]);
  });

  it("gives the interactive pilot to a person who stays but is unsure of the scope", () => {
    expect(prompts({ stay: "stay", scope: "unsure", preview: "direct" })).toEqual(["/selo-flow:pilot {demande}", "/selo-flow:build {blueprint}"]);
    expect(prompts({ stay: "stay", scope: "unsure", preview: "mockup" })).toEqual(["/selo-flow:mockup {demande}", "/selo-flow:pilot {demande} --mockup .planning/mockups/{fichier}", "/selo-flow:build {blueprint}"]);
    const pilot = laneFor({ stay: "stay", scope: "unsure", preview: "direct" });
    expect(pilot).toMatchObject({ lane: "pilot", name: "help.lanes.pilotWith.name", options: [], foot: "help.lanes.foot.pilotWith" });
    expect(pilot?.why).toEqual(["help.lanes.why.stay", "help.lanes.why.unsure", "help.lanes.why.direct"]);
    expect(pilot?.tracks.map((track) => track.colour)).toEqual(["pilot", "blueprint"]);
    expect(pilot?.tracks[0]?.steps[0]).toMatchObject({ state: "you", code: "/selo-flow:pilot {demande}" });
    expect(pilot?.tracks[1]?.steps[0]?.name).toBe("help.lanes.step.grill.name");
    expect(pilot?.isPilotWith).toBe(true);
    expect(laneFor({ stay: "leave", preview: "direct" })?.isPilotWith).toBeUndefined();
    const withMockup = laneFor({ stay: "stay", scope: "unsure", preview: "mockup" });
    expect(withMockup?.tracks.map((track) => track.colour)).toEqual(["mockup", "pilot", "blueprint"]);
    expect(withMockup?.tracks[1]?.steps[0]?.code).toBe("/selo-flow:pilot {demande} --mockup {fichier}");
  });

  it("names the options in their colours and the reasons", () => {
    const iterate = laneFor({ stay: "stay", scope: "page", preview: "iterate" });
    expect(iterate?.options).toEqual([{ label: "--iterate", colour: "iterate" }]);
    expect(iterate?.why).toEqual(["help.lanes.why.stay", "help.lanes.why.page", "help.lanes.why.iterate"]);
    expect(laneFor({ stay: "stay", scope: "page", preview: "direct" })?.options).toEqual([]);
    const pilot = laneFor({ stay: "leave", scope: "page", preview: "mockup" });
    expect(pilot?.options).toEqual([
      { label: "--mockup", colour: "mockup" },
      { label: "--autonomous", colour: "pilot" },
    ]);
    expect(pilot?.why).toEqual(["help.lanes.why.leave", "help.lanes.why.mockup"]);
  });

  it("draws the flow: the mockup's loop first, the steps the lane skips and those waiting on the person", () => {
    const blueprint = laneFor({ stay: "stay", scope: "new", preview: "mockup" });
    expect(blueprint?.tracks.map((track) => track.colour)).toEqual(["mockup", "blueprint"]);
    expect(blueprint?.tracks[1]?.steps[0]?.name).toBe("help.lanes.step.grill.name");
    expect(blueprint?.tracks[1]?.steps.find((step) => step.name === "help.lanes.step.approval.name")?.state).toBe("you");
    const fastlane = laneFor({ stay: "stay", scope: "page", preview: "direct" });
    expect(fastlane?.tracks.map((track) => track.colour)).toEqual(["fastlane"]);
    expect(fastlane?.tracks[0]?.steps[0]).toMatchObject({ name: "help.lanes.step.request.name", state: "you", code: "/selo-flow:fastlane {demande}" });
    expect(fastlane?.tracks[0]?.steps.filter((step) => step.state === "skip").map((step) => step.name)).toEqual([
      "help.lanes.step.grill.name",
      "help.lanes.step.blueprint.name",
      "help.lanes.step.approval.name",
      "help.lanes.step.specMerged.name",
    ]);
    const pilot = laneFor({ stay: "leave", preview: "direct" });
    expect(pilot?.tracks[0]?.steps.find((step) => step.name === "help.lanes.step.approval.name")?.state).toBe("skip");
    expect(pilot?.tracks[0]?.steps.at(-1)?.name).toBe("help.lanes.step.footer.name");
    expect(laneFor({ stay: "stay", scope: "page", preview: "iterate" })?.tracks.map((track) => track.colour)).toEqual(["iterate", "fastlane"]);
  });

  it("compares the browser with the mockup only when there is one", () => {
    const browser = (answers: Answers) => laneFor(answers)?.tracks.at(-1)?.steps.find((step) => step.name === "help.lanes.step.browser.name")?.hint;
    expect(browser({ stay: "stay", scope: "new", preview: "mockup" })).toBe("help.lanes.step.browser.mockup");
    expect(browser({ stay: "stay", scope: "new", preview: "direct" })).toBe("help.lanes.step.browser.hint");
  });
});

describe("the questions", () => {
  it("closes the scope once the person leaves", () => {
    expect(isScopeOpen({ stay: "leave" })).toBe(false);
    expect(isScopeOpen({ stay: "stay" })).toBe(true);
    expect(isScopeOpen({})).toBe(true);
  });

  it("allows iterating only to a person who stays on one page or component", () => {
    expect(isPreviewAllowed({ stay: "stay", scope: "page" }, "iterate")).toBe(true);
    expect(isPreviewAllowed({}, "iterate")).toBe(true);
    expect(isPreviewAllowed({ stay: "leave" }, "iterate")).toBe(false);
    expect(isPreviewAllowed({ stay: "stay", scope: "new" }, "iterate")).toBe(false);
    expect(isPreviewAllowed({ stay: "stay", scope: "unsure" }, "iterate")).toBe(false);
    expect(isPreviewAllowed({ stay: "leave" }, "mockup")).toBe(true);
  });

  it("drops an answer the new one rules out", () => {
    expect(answer({ stay: "stay", scope: "page", preview: "iterate" }, { scope: "new" })).toEqual({ stay: "stay", scope: "new" });
    expect(answer({ stay: "stay", scope: "page", preview: "iterate" }, { stay: "leave" })).toEqual({ stay: "leave", scope: "page" });
    expect(answer({ stay: "stay", scope: "page", preview: "mockup" }, { stay: "leave" })).toEqual({ stay: "leave", scope: "page", preview: "mockup" });
  });

  it("says why a choice is closed", () => {
    expect(previewHint({ stay: "leave" }, "iterate")).toBe("help.lanes.preview.iterate.stayOnly");
    expect(previewHint({ stay: "stay", scope: "new" }, "iterate")).toBe("help.lanes.preview.iterate.fastlaneOnly");
    expect(previewHint({ stay: "stay", scope: "unsure" }, "iterate")).toBe("help.lanes.preview.iterate.fastlaneOnly");
    expect(previewHint({ stay: "leave" }, "mockup")).toBe("help.lanes.preview.mockup.leave");
    expect(previewHint({}, "mockup")).toBe("help.lanes.preview.mockup.hint");
    expect(previewHint({}, "direct")).toBeUndefined();
  });

  it("counts a question answered only while it is open", () => {
    expect(isAnswered({ stay: "leave", scope: "page" }, "scope")).toBe(false);
    expect(isAnswered({ stay: "stay", scope: "page" }, "scope")).toBe(true);
    expect(isAnswered({}, "stay")).toBe(false);
  });
});

describe("splitPrompt", () => {
  it("parts the command, its placeholders and its options", () => {
    expect(splitPrompt("/selo-flow:fastlane {demande} --iterate")).toEqual([
      { text: "/selo-flow:fastlane " },
      { text: "{demande}", isPlaceholder: true },
      { text: " " },
      { text: "--iterate", isOption: true },
    ]);
    expect(splitPrompt("/selo-flow:blueprint {demande} --mockup .planning/mockups/{fichier}")).toEqual([
      { text: "/selo-flow:blueprint " },
      { text: "{demande}", isPlaceholder: true },
      { text: " " },
      { text: "--mockup .planning/mockups/", isOption: true },
      { text: "{fichier}", isOption: true, isPlaceholder: true },
    ]);
    expect(splitPrompt("/selo-flow:build {blueprint}")).toEqual([{ text: "/selo-flow:build " }, { text: "{blueprint}", isPlaceholder: true }]);
  });
});
