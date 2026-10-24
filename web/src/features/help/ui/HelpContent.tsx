import { useRef, useState } from "react";
import { t } from "../../../shared/lib/i18n/index.ts";
import {
  commitPlaces,
  helpTabs,
  type HelpTab,
  decisionGuide,
  idKinds,
  idRules,
  flows,
  lanes,
  lanesById,
  lifecycleSteps,
  roles,
  sectionOrder,
  sections,
  skills,
  planningTree,
  specChecks,
  specFlows,
  specLines,
  specSections,
  specUnits,
  stubSteps,
  technicalSections,
  vocabulary,
  whereRules,
} from "../content.ts";
import {
  DecisionGuideList,
  type FileExample,
  Glossary,
  HelpSection,
  HelpTabs,
  LaneList,
  LifecycleList,
  Note,
  PlanningTree,
  RoleCards,
  RuleCards,
  SkillCards,
  SkillList,
  SpecFlows,
  SpecSample,
  SpecUnits,
  Split,
  Strip,
  SubTitle,
  TableOfContents,
  TextList,
} from "./HelpParts.tsx";

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

// help FR-01 to FR-05, FR-08, FR-15, FR-17.
function GuideTab() {
  return (
    <>
      <TableOfContents title="help.toc.title" sections={sectionOrder} />

      <HelpSection section={sections.lanes} intro="help.lanes.intro">
        <LaneList lanes={lanes} />
        <SubTitle text="help.flows.title" />
        <Note text="help.flows.intro" />
        <LaneList lanes={flows} />
        <SubTitle text="help.guide.title" />
        <Note text="help.guide.intro" />
        <DecisionGuideList guide={decisionGuide} lanesById={lanesById} />
      </HelpSection>

      <HelpSection section={sections.lifecycle} intro="help.lifecycle.intro">
        <LifecycleList steps={lifecycleSteps} lanes={lanes} />
        <SubTitle text="help.commits.title" />
        <TextList items={commitPlaces} />
      </HelpSection>

      <HelpSection section={sections.skills} intro="help.skills.listIntro">
        <SkillList skills={skills} />
      </HelpSection>

      <HelpSection section={sections.vocabulary}>
        <Glossary terms={vocabulary} />
      </HelpSection>
    </>
  );
}

// help FR-13, its figures FR-14.
function SpecsTab() {
  const [example, setExample] = useState<FileExample | null>(null);
  return (
    <>
      <Note text="help.specs.intro" />
      <Split>
        <PlanningTree caption="help.specs.tree.caption" root={planningTree} selected={example?.path} onSelect={setExample} />
        {example ? (
          <SpecSample caption={t("help.specs.tree.example", { path: example.path })} text={example.text} onClose={() => setExample(null)} />
        ) : (
          <RuleCards rules={whereRules} />
        )}
      </Split>

      <HelpSection section={specSections.units}>
        <SpecUnits units={specUnits} />
      </HelpSection>

      <HelpSection section={specSections.ids}>
        <RuleCards rules={idKinds} layout="dense" />
        <TextList items={idRules} />
      </HelpSection>

      <HelpSection section={specSections.follows} intro="help.specs.follows.intro">
        <SpecFlows caption="help.specs.flow.caption" flows={specFlows} lanesById={lanesById} />
        <Note text="help.specs.follows.noChange" />
      </HelpSection>

      <HelpSection section={specSections.stubs} intro="help.specs.stubs.intro">
        <Strip steps={stubSteps} />
      </HelpSection>

      <HelpSection section={specSections.specLine} intro="help.specs.specLine.intro">
        <RuleCards rules={specLines} layout="rows" />
        <SubTitle text="help.specs.specCheck.title" />
        <Note text="help.specs.specCheck.intro" />
        <RuleCards rules={specChecks} layout="rows" />
      </HelpSection>
    </>
  );
}

// help FR-06, FR-07.
function TechnicalTab() {
  return (
    <>
      <HelpSection section={technicalSections.skills} intro="help.skills.intro">
        <SkillCards skills={skills} />
        <Note text="help.skills.autonomousNote" />
      </HelpSection>
      <HelpSection section={technicalSections.roles} intro="help.roles.intro">
        <RoleCards roles={roles} />
      </HelpSection>
    </>
  );
}
