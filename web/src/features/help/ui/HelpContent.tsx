import {
  commitPlaces,
  decisionGuide,
  lanes,
  lanesById,
  lifecycleSteps,
  roles,
  sectionOrder,
  sections,
  skills,
  vocabulary,
} from "../content.ts";
import {
  DecisionGuideList,
  Glossary,
  HelpSection,
  LaneList,
  LifecycleList,
  Note,
  RoleCards,
  SkillCards,
  SubTitle,
  TableOfContents,
  TextList,
} from "./HelpParts.tsx";

// help FR-01 to FR-08: the same content on the page and in the popup (help FR-10).
export function HelpContent() {
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
