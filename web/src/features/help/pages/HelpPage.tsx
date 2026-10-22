import { t } from "../../../shared/lib/i18n/index.ts";
import { PageTitle } from "../../../shared/ui/PageTitle.tsx";
import { Panel } from "../../../shared/ui/Panel.tsx";
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
} from "../ui/HelpParts.tsx";
import styles from "./HelpPage.module.css";

// help FR-09: static content only, no data hook: the page renders the same with the API down.
export function HelpPage() {
  return (
    <main className={styles.page}>
      <Panel>
        <header className={styles.header}>
          <PageTitle>{t("help.page.title")}</PageTitle>
          <p className={styles.intro}>{t("help.page.intro")}</p>
        </header>

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
      </Panel>
    </main>
  );
}
