import type { ReactNode } from "react";
import { t, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import { Card } from "../../../shared/ui/Card.tsx";
import { Segmented } from "../../../shared/ui/Segmented.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import type { DecisionGuide, FlowStep, HelpTab, Lane, LaneId, LifecycleStep, Role, Section, Skill, Term, TreeNode } from "../content.ts";
import styles from "./HelpParts.module.css";

// help FR-11: a lane's class sets --lane, which its card, name and dot read.
const laneClass = (lane: LaneId) => styles[`lane-${lane}`];

function LaneName({ lane }: { lane: Lane }) {
  return <strong className={`${styles.laneName} ${laneClass(lane.id)}`}>{t(lane.name)}</strong>;
}

function Code({ text }: { text: MessageKey }) {
  return <code className={styles.code}>{t(text)}</code>;
}

// A label key carries its own colon (and the narrow no-break space before it).
function Labelled({ label, children }: { label: MessageKey; children: ReactNode }) {
  return (
    <p className={styles.text}>
      <span className={styles.label}>{t(label)}</span> {children}
    </p>
  );
}

export function TableOfContents({ title, sections }: { title: MessageKey; sections: Section[] }) {
  return (
    <nav className={styles.toc} aria-labelledby="help-toc">
      <h2 id="help-toc" className={styles.tocTitle}>
        {t(title)}
      </h2>
      <ol className={styles.tocList}>
        {sections.map((section) => (
          <li key={section.id}>
            <a
              className={styles.tocLink}
              href={`#${section.id}`}
              onClick={(event) => {
                // Scrolls to the section without touching the address: inside the popup, the page under it keeps its own.
                event.preventDefault();
                document.getElementById(section.id)?.scrollIntoView({ block: "start" });
              }}
            >
              {t(section.title)}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function HelpSection({ section, intro, children }: { section: Section; intro?: MessageKey; children: ReactNode }) {
  return (
    <section id={section.id} className={styles.section} aria-labelledby={`${section.id}-title`}>
      <h2 id={`${section.id}-title`} className={styles.sectionTitle}>
        {t(section.title)}
      </h2>
      {intro && <p className={styles.muted}>{t(intro)}</p>}
      {children}
    </section>
  );
}

export function SubTitle({ text }: { text: MessageKey }) {
  return <h3 className={styles.subTitle}>{t(text)}</h3>;
}

export function LaneList({ lanes }: { lanes: Lane[] }) {
  return (
    <ul className={styles.cards}>
      {lanes.map((lane) => (
        <li key={lane.id} className={`${styles.cell} ${styles.laneCell} ${laneClass(lane.id)}`}>
          <Card>
            <h3 className={`${styles.cardTitle} ${styles.laneTitle}`}>
              <span className={styles.dot} aria-hidden="true" />
              {t(lane.name)}
            </h3>
            <Labelled label="help.lanes.when">{t(lane.when)}</Labelled>
            <div className={styles.codes} aria-label={t("help.lanes.prompt")}>
              {lane.prompts.map((prompt) => (
                <Code key={prompt} text={prompt} />
              ))}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function DecisionGuideList({ guide, lanesById }: { guide: DecisionGuide; lanesById: Record<LaneId, Lane> }) {
  const last = guide.questions.length - 1;
  return (
    <ol className={styles.steps}>
      {guide.questions.map((step, index) => (
        <li key={step.question} className={styles.cell}>
          <Card>
            <p className={styles.numbered}>{t(step.question)}</p>
            <ul className={styles.textList}>
              <li>
                <span className={styles.label}>{t("help.guide.yes")}</span> <LaneName lane={lanesById[step.yes]} />
              </li>
              <li>
                <span className={styles.label}>{t("help.guide.no")}</span>{" "}
                {index === last ? <LaneName lane={lanesById[guide.otherwise]} /> : t("help.guide.next")}
              </li>
            </ul>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function LifecycleList({ steps, lanes }: { steps: LifecycleStep[]; lanes: Lane[] }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step) => (
        <li key={step.name} className={styles.cell}>
          <Card>
            <div className={styles.stepHead}>
              <h3 className={`${styles.cardTitle} ${styles.numbered}`}>{t(step.name)}</h3>
              <span className={styles.tags} aria-label={t("help.lifecycle.lanes")}>
                {lanes
                  .filter((lane) => step.lanes.includes(lane.id))
                  .map((lane) => (
                    <Tag key={lane.id} color={`var(--lane-${lane.id})`}>
                      {t(lane.short)}
                    </Tag>
                  ))}
              </span>
            </div>
            <p className={styles.text}>{t(step.text)}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function TextList({ items }: { items: MessageKey[] }) {
  return (
    <ul className={styles.textList}>
      {items.map((item) => (
        <li key={item}>{t(item)}</li>
      ))}
    </ul>
  );
}

// Under an h3 subtitle: the card titles are h4.
export function SkillCards({ skills }: { skills: Skill[] }) {
  return (
    <ul className={styles.cards}>
      {skills.map((skill) => (
        <li
          key={skill.name}
          className={skill.lane ? `${styles.cell} ${styles.laneCell} ${laneClass(skill.lane)}` : styles.cell}
        >
          <Card>
            <h4 className={skill.lane ? `${styles.cardTitle} ${styles.laneTitle}` : styles.cardTitle}>
              {skill.lane && <span className={styles.dot} aria-hidden="true" />}
              {t(skill.name)}
            </h4>
            <p className={styles.text}>{t(skill.what)}</p>
            <Labelled label="help.skills.when">{t(skill.when)}</Labelled>
            <div className={styles.codes} aria-label={t("help.skills.prompt")}>
              <Code text={skill.prompt} />
            </div>
            <div className={styles.options}>
              <span className={styles.label}>{t("help.skills.options")}</span>
              {skill.options.length === 0
                ? t("help.skills.noOption")
                : skill.options.map((option) => <Code key={option} text={option} />)}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function RoleCards({ roles }: { roles: Role[] }) {
  return (
    <ul className={styles.cards}>
      {roles.map((role) => (
        <li key={role.name} className={styles.cell}>
          <Card>
            <h4 className={styles.cardTitle}>{t(role.name)}</h4>
            <p className={styles.text}>{t(role.what)}</p>
            <Labelled label="help.roles.never">{t(role.never)}</Labelled>
            <Labelled label="help.roles.model">
              <Code text={role.model} />
            </Labelled>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function Glossary({ terms }: { terms: Term[] }) {
  return (
    <dl className={styles.glossary}>
      {terms.map((term) => (
        <Card key={term.term}>
          <dt className={styles.cardTitle}>{t(term.term)}</dt>
          <dd className={styles.text}>{t(term.definition)}</dd>
        </Card>
      ))}
    </dl>
  );
}

export function Note({ text }: { text: MessageKey }) {
  return <p className={styles.muted}>{t(text)}</p>;
}

export function CodeList({ label, items }: { label: MessageKey; items: MessageKey[] }) {
  return (
    <div className={styles.codes} aria-label={t(label)}>
      {items.map((item) => (
        <Code key={item} text={item} />
      ))}
    </div>
  );
}

// help FR-12: pressed buttons rather than ARIA tabs, which would also need arrow-key navigation.
export function HelpTabs({ tabs, value, onChange }: { tabs: { value: HelpTab; label: MessageKey }[]; value: HelpTab; onChange(tab: HelpTab): void }) {
  return (
    <div className={styles.tabs}>
      <Segmented label={t("help.tabs.label")} options={tabs.map((tab) => ({ value: tab.value, label: t(tab.label) }))} value={value} onChange={onChange} />
    </div>
  );
}

function TreeItems({ nodes }: { nodes: TreeNode[] }) {
  return (
    <ul className={styles.treeList}>
      {nodes.map((node) => (
        <li key={node.name} className={styles.treeItem}>
          <span className={node.children ? styles.treeFolder : styles.treeFile}>{node.name}</span>
          {node.note && <span className={styles.treeNote}>{t(node.note)}</span>}
          {node.children && <TreeItems nodes={node.children} />}
        </li>
      ))}
    </ul>
  );
}

// help FR-14.
export function PlanningTree({ caption, root }: { caption: MessageKey; root: TreeNode }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.figureCaption}>{t(caption)}</figcaption>
      <div className={styles.tree}>
        <span className={styles.treeFolder}>{root.name}</span>
        <TreeItems nodes={root.children ?? []} />
      </div>
    </figure>
  );
}

// help FR-14: the ids of a sample spec stand out, as a reader looks for them first.
export function SpecSample({ caption, text }: { caption: MessageKey; text: string }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.figureCaption}>{t(caption)}</figcaption>
      <pre className={styles.sample}>
        {text.split(/\b((?:FR|BR|US|Q)-\d+)\b/).map((part, index) =>
          index % 2 === 1 ? (
            <mark key={index} className={styles.sampleId}>
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </pre>
    </figure>
  );
}

// help FR-14: one row of steps per lane, in its colour.
export function SpecFlows({ caption, flows, lanesById }: { caption: MessageKey; flows: { lane: LaneId; steps: FlowStep[] }[]; lanesById: Record<LaneId, Lane> }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.figureCaption}>{t(caption)}</figcaption>
      {flows.map((flow) => (
        <div key={flow.lane} className={`${styles.flow} ${laneClass(flow.lane)}`}>
          <LaneName lane={lanesById[flow.lane]} />
          <ol className={styles.flowSteps}>
            {flow.steps.map((step) => (
              <li key={step.label} className={styles.flowStep}>
                <span>{t(step.label)}</span>
                {step.code && <Code text={step.code} />}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </figure>
  );
}
