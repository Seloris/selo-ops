import { useState } from "react";
import {
  commitPlaces,
  helpTabs,
  type HelpTab,
  decisionGuide,
  lanes,
  lanesById,
  lifecycleSteps,
  roles,
  sectionOrder,
  sections,
  skills,
  specTopics,
  vocabulary,
} from "../content.ts";
import {
  CodeList,
  DecisionGuideList,
  Glossary,
  HelpSection,
  HelpTabs,
  LaneList,
  LifecycleList,
  Note,
  RoleCards,
  SkillCards,
  SubTitle,
  TableOfContents,
  TextList,
} from "./HelpParts.tsx";

// help FR-12: the same tabs on the page and in the popup (help FR-10), the guide first.
export function HelpContent() {
  const [tab, setTab] = useState<HelpTab>("guide");
  return (
    <>
      <HelpTabs tabs={helpTabs} value={tab} onChange={setTab} />
      {tab === "guide" ? <GuideTab /> : <SpecsTab />}
    </>
  );
}

// help FR-13.
function SpecsTab() {
  return (
    <>
      <Note text="help.specs.intro" />
      {specTopics.map((topic) => (
        <HelpSection key={topic.section.id} section={topic.section}>
          <TextList items={topic.points} />
          {topic.examples.length > 0 && <CodeList label="help.specs.examples" items={topic.examples} />}
        </HelpSection>
      ))}
    </>
  );
}

// help FR-01 to FR-08.
function GuideTab() {
  return (
    <>
      <TableOfContents title="help.toc.title" sections={sectionOrder} />

      <HelpSection section={sections.lanes} intro="help.lanes.intro">
        <LaneList lanes={lanes} />
        <SubTitle text="help.guide.title" />
        <Note text="help.guide.intro" />
        <DecisionGuideList guide={decisionGuide} lanesById={lanesById} />
      </HelpSection>

      <HelpSection section={sections.lifecycle} intro="help.lifecycle.intro">
        <LifecycleList steps={lifecycleSteps} lanes={lanes} />
        <SubTitle text="help.commits.title" />
        <TextList items={commitPlaces} />
      </HelpSection>

      <HelpSection section={sections.skills} intro="help.skills.intro">
        <SubTitle text="help.skills.skillsTitle" />
        <SkillCards skills={skills} />
        <Note text="help.skills.autonomousNote" />
        <SubTitle text="help.roles.title" />
        <RoleCards roles={roles} />
      </HelpSection>

      <HelpSection section={sections.vocabulary}>
        <Glossary terms={vocabulary} />
      </HelpSection>
    </>
  );
}
