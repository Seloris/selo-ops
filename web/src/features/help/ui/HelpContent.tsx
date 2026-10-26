import { useRef, useState } from "react";
import {
  commitPlaces,
  decisionTree,
  exampleBlueprint,
  exampleDiffs,
  exampleMergeCommit,
  helpTabs,
  type HelpTab,
  idKinds,
  laneLegend,
  lifecycle,
  planningTree,
  roles,
  sections,
  seeFirst,
  settings,
  skills,
  specFlows,
  specLines,
  stubSteps,
  whereRules,
} from "../content.ts";
import { DecisionTree, FileDiff, Flows, HelpSection, HelpTabs, LaneLegend, MarkdownFile, MergeArrow, Note, PlanningTree, Rows, RuleCards, Split, Steps } from "./HelpParts.tsx";

// help FR-12: the same tabs on the page and in the popup (help FR-10), the guide first.
export function HelpContent() {
  const [tab, setTab] = useState<HelpTab>("guide");
  const top = useRef<HTMLDivElement>(null);
  const choose = (next: HelpTab) => {
    setTab(next);
    // While the tabs stick (scrolled past), the new tab opens at its top, not halfway down.
    const marker = top.current;
    const bar = marker?.nextElementSibling;
    if (marker && bar && marker.getBoundingClientRect().bottom < bar.getBoundingClientRect().top - 1) marker.scrollIntoView({ block: "start" });
  };
  return (
    <>
      <div ref={top} />
      <HelpTabs tabs={helpTabs} value={tab} onChange={choose} />
      {tab === "guide" ? <GuideTab /> : tab === "specs" ? <SpecsTab /> : <TechnicalTab />}
    </>
  );
}

// help FR-02 to FR-05, FR-17.
function GuideTab() {
  return (
    <>
      <HelpSection section={sections.lanes}>
        <DecisionTree branches={decisionTree} />
        <Note text="help.lanes.unsure" code="help.lanes.unsurePrompt" />
      </HelpSection>
      <HelpSection section={sections.flows} intro="help.flows.intro">
        <Flows flows={seeFirst} />
      </HelpSection>
      <HelpSection section={sections.lifecycle}>
        <LaneLegend lanes={laneLegend} />
        <Steps steps={lifecycle} lanes={laneLegend} />
      </HelpSection>
      <HelpSection section={sections.commits}>
        <RuleCards rules={commitPlaces} />
      </HelpSection>
    </>
  );
}

// help FR-13, its figures FR-14, its example FR-19.
function SpecsTab() {
  return (
    <>
      <HelpSection section={sections.where}>
        <Split>
          <PlanningTree caption="help.specs.tree.caption" root={planningTree} />
          <RuleCards rules={whereRules} />
        </Split>
      </HelpSection>
      <HelpSection section={sections.ids}>
        <RuleCards rules={idKinds} dense />
        <Note text="help.specs.ids.rule" />
      </HelpSection>
      <HelpSection section={sections.follows}>
        <Flows flows={specFlows} />
        <Note text="help.specs.follows.note" />
      </HelpSection>
      <HelpSection section={sections.example} intro="help.specs.example.intro">
        <MarkdownFile file={exampleBlueprint} />
        <MergeArrow label="help.specs.example.merge" codes={exampleMergeCommit} />
        {exampleDiffs.map((diff) => (
          <FileDiff key={diff.path} diff={diff} />
        ))}
      </HelpSection>
      <HelpSection section={sections.stubs}>
        <Steps steps={stubSteps} />
      </HelpSection>
      <HelpSection section={sections.specLine} intro="help.specs.specLine.intro">
        <Rows rows={specLines} />
      </HelpSection>
    </>
  );
}

// help FR-06, FR-07, FR-18.
function TechnicalTab() {
  return (
    <>
      <HelpSection section={sections.skills}>
        <Rows rows={skills} />
      </HelpSection>
      <HelpSection section={sections.roles} intro="help.roles.intro">
        <Rows rows={roles} />
      </HelpSection>
      <HelpSection section={sections.settings} intro="help.settings.intro">
        <Rows rows={settings} />
      </HelpSection>
    </>
  );
}
