import type { ReactNode } from "react";
import { t, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import { Card } from "../../../shared/ui/Card.tsx";
import { Segmented } from "../../../shared/ui/Segmented.tsx";
import { SpecChip, SpecIcon, specColor } from "../../../shared/ui/SpecKind.tsx";
import type { Branch, ColourId, DeltaMark, Flow, HelpTab, LaneId, MdDiff, MdFile, MdLine, Row, Rule, Section, Step, TreeNode } from "../content.ts";
import styles from "./HelpParts.module.css";

// help FR-11: a lane's class sets --lane, which its boxes, names, prompts and dots read.
const laneClass = (lane: ColourId) => styles[`lane-${lane}`];

function Code({ text }: { text: MessageKey }) {
  return <code className={styles.code}>{t(text)}</code>;
}

export function HelpSection({ section, intro, children }: { section: Section; intro?: MessageKey; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={section.id}>
      <h2 id={section.id} className={styles.sectionTitle}>
        {t(section.title)}
      </h2>
      {intro && <p className={styles.muted}>{t(intro)}</p>}
      {children}
    </section>
  );
}

export function Note({ text, code }: { text: MessageKey; code?: MessageKey }) {
  return (
    <p className={styles.muted}>
      {t(text)} {code && <Code text={code} />}
    </p>
  );
}

// help FR-12: pressed buttons rather than ARIA tabs, which would also need arrow-key navigation; the bar sticks to the top of the scroller.
export function HelpTabs({ tabs, value, onChange }: { tabs: { value: HelpTab; label: MessageKey }[]; value: HelpTab; onChange(tab: HelpTab): void }) {
  return (
    <div className={styles.tabs}>
      <Segmented label={t("help.tabs.label")} options={tabs.map((tab) => ({ value: tab.value, label: t(tab.label) }))} value={value} onChange={onChange} />
    </div>
  );
}

// help FR-02, FR-03: a question on the left, its « oui » arrow to a lane on the right, its « non » down to the next question.
export function DecisionTree({ branches }: { branches: Branch[] }) {
  return (
    <ol className={styles.decision}>
      {branches.map((branch, index) => (
        <li key={branch.lane} className={`${styles.branch} ${laneClass(branch.lane)}`}>
          <p className={branch.question ? styles.question : `${styles.question} ${styles.otherwise}`}>{t(branch.question ?? "help.lanes.otherwise")}</p>
          <span className={styles.yes}>{branch.question ? t("help.lanes.yes") : ""}</span>
          <div className={styles.laneBox}>
            <h3 className={styles.laneTitle}>
              <span className={styles.dot} aria-hidden="true" />
              {t(branch.name)}
            </h3>
            <p className={styles.text}>{t(branch.hint)}</p>
            <div className={styles.codes}>
              {branch.prompts.map((prompt) => (
                <Code key={prompt} text={prompt} />
              ))}
            </div>
          </div>
          {/* After the lane in reading order; the grid puts it under the question. */}
          {index < branches.length - 1 && <span className={styles.no}>{t("help.lanes.no")}</span>}
        </li>
      ))}
    </ol>
  );
}

// help FR-14, FR-17: one row of boxes joined by arrows per lane or flow, in its colour.
export function Flows({ flows }: { flows: Flow[] }) {
  return (
    <div className={styles.flows}>
      {flows.map((flow) => (
        <div key={flow.lane} className={`${styles.flow} ${laneClass(flow.lane)}`}>
          <h3 className={styles.laneTitle}>
            <span className={styles.dot} aria-hidden="true" />
            {t(flow.name)}
          </h3>
          <ol className={styles.flowSteps}>
            {flow.steps.map((step, index) => (
              <li key={index} className={styles.flowStep}>
                {step.label && <span>{t(step.label)}</span>}
                {step.code && <Code text={step.code} />}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

// help FR-04: the lanes' dots, named once above the steps.
export function LaneLegend({ lanes }: { lanes: { id: LaneId; name: MessageKey }[] }) {
  return (
    <ul className={styles.legend}>
      {lanes.map((lane) => (
        <li key={lane.id} className={laneClass(lane.id)}>
          <span className={styles.dot} aria-hidden="true" />
          {t(lane.name)}
        </li>
      ))}
    </ul>
  );
}

// help FR-04, FR-14: numbered tiles in reading order, several per row, one per row when narrow.
export function Steps({ steps, lanes }: { steps: Step[]; lanes?: { id: LaneId; name: MessageKey }[] }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step, index) => {
        const passing = lanes?.filter((lane) => step.lanes?.includes(lane.id)) ?? [];
        return (
          <li key={step.name} className={styles.step}>
            <span className={styles.stepNumber}>{index + 1}</span>
            <strong>{t(step.name)}</strong>
            <span className={styles.hint}>{t(step.hint)}</span>
            {step.code && <Code text={step.code} />}
            {passing.length > 0 && (
              <span className={styles.dots} role="img" aria-label={t("help.lifecycle.lanes", { lanes: passing.map((lane) => t(lane.name)).join(", ") })}>
                {passing.map((lane) => (
                  <span key={lane.id} className={`${styles.dot} ${laneClass(lane.id)}`} />
                ))}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Short cards, a code or a kind chip on top of one sentence; "dense" for one-word cards.
export function RuleCards({ rules, dense = false }: { rules: Rule[]; dense?: boolean }) {
  return (
    <ul className={dense ? `${styles.rules} ${styles.dense}` : styles.rules}>
      {rules.map((rule) => (
        <li key={rule.text} className={styles.cell}>
          <Card>
            {rule.kind && <SpecChip kind={rule.kind} />}
            {rule.head && <Code text={rule.head} />}
            <p className={styles.text}>{t(rule.text)}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

// help FR-06, FR-07, FR-18: one line per item, its code in its lane's colour, then one sentence and its options.
export function Rows({ rows }: { rows: Row[] }) {
  return (
    <dl className={styles.rows}>
      {rows.map((row) => (
        <div key={row.head} className={`${styles.row} ${row.lane ? laneClass(row.lane) : ""}`}>
          <dt className={styles.rowHead}>{t(row.head)}</dt>
          <dd className={styles.rowBody}>
            <span className={styles.text}>{t(row.text)}</span>
            {row.codes && (
              <span className={styles.codes} role="group" aria-label={t("help.skills.options")}>
                {row.codes.map((code) => (
                  <Code key={code} text={code} />
                ))}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TreeItems({ nodes }: { nodes: TreeNode[] }) {
  return (
    <ul className={styles.treeList}>
      {nodes.map((node) => (
        <li key={node.name} className={styles.treeItem}>
          <span className={node.children || node.name.endsWith("/") ? styles.treeFolder : styles.treeFile} style={node.kind ? { color: specColor(node.kind) } : undefined}>
            {node.kind && <SpecIcon kind={node.kind} />}
            {node.name}
          </span>
          {node.note && <span className={styles.treeNote}>{t(node.note)}</span>}
          {node.children && <TreeItems nodes={node.children} />}
        </li>
      ))}
    </ul>
  );
}

// help FR-14: the tree of `.planning/`, one short note per entry.
export function PlanningTree({ caption, root }: { caption: MessageKey; root: TreeNode }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>{t(caption)}</figcaption>
      <div className={styles.tree}>
        <span className={styles.treeFolder}>{root.name}</span>
        <TreeItems nodes={root.children ?? []} />
      </div>
    </figure>
  );
}

const signs: Record<DeltaMark, string> = { add: "+", change: "~", remove: "-" };
const markLabels: Record<DeltaMark, MessageKey> = { add: "help.specs.example.add", change: "help.specs.example.change", remove: "help.specs.example.remove" };

// help FR-19: a Markdown file as text, each marked line tinted and signed in the gutter, so the mark is not colour alone.
function Markdown({ lines }: { lines: MdLine[] }) {
  return (
    <pre className={styles.md}>
      {lines.map((line, index) => (
        <span key={index} className={line.mark ? `${styles.mdLine} ${styles[`md-${line.mark}`]}` : styles.mdLine}>
          <span className={styles.mdSign} aria-hidden="true">
            {line.mark ? signs[line.mark] : " "}
          </span>
          <span>
            {line.mark && <span className={styles.srOnly}>{`${t(markLabels[line.mark])} : `}</span>}
            {line.text || " "}
          </span>
        </span>
      ))}
    </pre>
  );
}

export function MarkdownFile({ file }: { file: MdFile }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.mdPath}>{file.path}</figcaption>
      <Markdown lines={file.lines} />
    </figure>
  );
}

// help FR-19: a spec file before and after the merge, side by side, one under the other when narrow.
export function FileDiff({ diff }: { diff: MdDiff }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.mdPath}>{diff.path}</figcaption>
      <div className={styles.diff}>
        <div className={styles.figure}>
          <span className={styles.caption}>{t("help.specs.example.before")}</span>
          <Markdown lines={diff.before} />
        </div>
        <div className={styles.figure}>
          <span className={styles.caption}>{t("help.specs.example.after")}</span>
          <Markdown lines={diff.after} />
        </div>
      </div>
    </figure>
  );
}

// help FR-19: the step between the blueprint and the specs it rewrites.
export function MergeArrow({ label, codes }: { label: MessageKey; codes: string[] }) {
  return (
    <div className={styles.merge}>
      <span className={styles.mergeArrow} aria-hidden="true">
        ↓
      </span>
      <span>{t(label)}</span>
      {codes.map((code) => (
        <code key={code} className={styles.code}>
          {code}
        </code>
      ))}
    </div>
  );
}

// Two figures side by side, one under the other when narrow.
export function Split({ children }: { children: ReactNode }) {
  return <div className={styles.split}>{children}</div>;
}
