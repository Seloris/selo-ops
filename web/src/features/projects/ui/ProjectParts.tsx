import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import { t, tn, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import { SpecChip, type SpecKind } from "../../../shared/ui/SpecKind.tsx";
import { StatusDot, type DotTone } from "../../../shared/ui/StatusDot.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import { deltaSplit, progressSteps, stateCounts, type Blueprint, type BlueprintState, type DeltaLine } from "../data/projectView.ts";
import styles from "./ProjectParts.module.css";

// projects FR-14: one colour per state, the same everywhere.
export const stateColor = (state: BlueprintState) => `var(--bp-${state})`;
export const stateLabel = (state: BlueprintState) => t(`projects.state.${state}` as MessageKey);
const colorStyle = (state: BlueprintState) => ({ "--bp": stateColor(state) }) as CSSProperties;

export function StateTag({ state }: { state: BlueprintState }) {
  return <Tag color={stateColor(state)}>{stateLabel(state)}</Tag>;
}

// A bar split by state, each part as wide as its count; with its legend when `withLegend`.
export function StateBar({ blueprints, withLegend = false }: { blueprints: Blueprint[]; withLegend?: boolean }) {
  const counts = stateCounts(blueprints);
  if (counts.length === 0) return null;
  const label = counts.map((c) => `${stateLabel(c.state)} ${c.count}`).join(", ");
  return (
    <div className={styles.stateBar}>
      <div className={styles.bar} role="img" aria-label={label} title={label}>
        {counts.map((c) => (
          <span key={c.state} className={styles.segment} style={{ ...colorStyle(c.state), flexGrow: c.count }} />
        ))}
      </div>
      {withLegend && (
        <ul className={styles.legend}>
          {counts.map((c) => (
            <li key={c.state}>
              <span className={styles.swatch} style={colorStyle(c.state)} />
              {stateLabel(c.state)}
              <b>{c.count}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// `project` BR-03: one pip per stage, filled once ticked, then the review and the merge; `large` lists each stage with its
// commit (projects FR-11).
export function ProgressTrack({ blueprint, isLarge = false }: { blueprint: Blueprint; isLarge?: boolean }) {
  const steps = progressSteps(blueprint);
  if (steps.length === 0) return null;
  const nameOf = (s: (typeof steps)[number]) =>
    s.kind === "stage" ? t("projects.progress.stage", { number: s.number, component: s.component }) : t(s.kind === "review" ? "projects.progress.review" : "projects.progress.merged");
  const label = `${t("projects.progress.label")} : ${steps.map((s) => `${nameOf(s)} ${t(s.isDone ? "projects.progress.done" : "projects.progress.todo")}`).join(", ")}`;
  if (!isLarge) {
    return (
      <span className={styles.track} style={colorStyle(blueprint.state)} role="img" aria-label={label} title={label}>
        {steps.map((s, i) =>
          s.kind === "stage" ? (
            <span key={i} className={styles.stage}>
              <span className={`${styles.pip} ${styles.numbered} ${s.isDone ? styles.filled : ""}`}>{s.number}</span>
              {s.component}
            </span>
          ) : (
            <span key={i} className={`${styles.milestone} ${s.isDone ? styles.reached : ""}`}>
              {t(s.kind === "review" ? "projects.progress.reviewShort" : "projects.progress.mergedShort")}
            </span>
          ),
        )}
      </span>
    );
  }
  return (
    <ol className={styles.steps} style={colorStyle(blueprint.state)} aria-label={t("projects.progress.label")}>
      {steps.map((s, i) => (
        <li key={i} className={s.isDone ? styles.done : ""}>
          <span className={`${styles.pip} ${s.isDone ? styles.filled : ""}`} aria-hidden="true" />
          <span className={styles.stepName}>{nameOf(s)}</span>
          {s.kind === "stage" && (
            <span className={styles.commit}>
              {s.sha ? (
                <>
                  <code className={styles.sha}>{s.sha}</code> <span className={styles.mono}>{s.commit}</span>
                </>
              ) : (
                <>
                  <span className={styles.mono}>{s.commit}</span> <span className={styles.muted}>· {t("projects.panel.notCommitted")}</span>
                </>
              )}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

// projects FR-08: the delta's lines added, changed and removed, in figures, the zeros left out.
export function DeltaFigures({ delta }: { delta: DeltaLine[] }) {
  const { added, changed, removed } = deltaSplit(delta);
  if (delta.length === 0) return null;
  const label = t("projects.delta.label", { added, changed, removed });
  return (
    <span className={styles.figures} role="img" aria-label={label} title={label}>
      {added > 0 && <span className={styles.addText}>+{added}</span>}
      {changed > 0 && <span className={styles.changeText}>~{changed}</span>}
      {removed > 0 && <span className={styles.removeText}>−{removed}</span>}
    </span>
  );
}

// projects FR-11: the same figures behind a bar of their shares.
export function DeltaBar({ delta }: { delta: DeltaLine[] }) {
  const { added, changed, removed } = deltaSplit(delta);
  if (delta.length === 0) return null;
  return (
    <span className={styles.delta}>
      <span className={styles.deltaBar} aria-hidden="true">
        {added > 0 && <span className={styles.added} style={{ flexGrow: added }} />}
        {changed > 0 && <span className={styles.changed} style={{ flexGrow: changed }} />}
        {removed > 0 && <span className={styles.removed} style={{ flexGrow: removed }} />}
      </span>
      <DeltaFigures delta={delta} />
    </span>
  );
}

// projects FR-08: a « Terminé » blueprint's progress in short: one filled pip per commit holding its number, then the review and the merge checked.
export function DoneSummary({ blueprint }: { blueprint: Blueprint }) {
  const label = tn("projects.progress.doneSummary", blueprint.stages.length);
  return (
    <span className={styles.track} style={colorStyle("done")} role="img" aria-label={label} title={label}>
      {blueprint.stages.map((s) => (
        <span key={s.number} className={`${styles.pip} ${styles.numbered} ${styles.filled}`}>
          {s.number}
        </span>
      ))}
      <span className={styles.check}>✓ {t("projects.progress.reviewed")}</span>
      <span className={styles.check}>✓ {t("projects.progress.mergedDone")}</span>
    </span>
  );
}

// projects FR-09: a sheet's FRs and BRs, scaled to the biggest sheet.
export function SizeBar({ fr, br, max }: { fr: number; br: number; max: number }) {
  return (
    <span className={styles.size} aria-hidden="true">
      <span className={styles.fr} style={{ width: `${(fr / max) * 100}%` }} />
      <span className={styles.br} style={{ width: `${(br / max) * 100}%` }} />
    </span>
  );
}

const HUES = {
  progress: styles.hueProgress,
  blueprints: styles.hueBlueprints,
  specs: styles.hueSpecs,
  ideas: styles.hueIdeas,
  debt: styles.hueDebt,
};

export type Hue = keyof typeof HUES;

export function HueChip({ icon, hue }: { icon: ReactNode; hue: Hue }) {
  return <span className={`${styles.chip} ${HUES[hue]}`}>{icon}</span>;
}

// A heading with its icon on a soft tint of its section's hue, as in the session detail.
export function SectionTitle({ icon, hue, title, count }: { icon: ReactNode; hue: Hue; title: string; count?: number }) {
  return (
    <h3 className={styles.sectionTitle}>
      <HueChip icon={icon} hue={hue} />
      {title}
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </h3>
  );
}

export interface LiveItem {
  id: string;
  tone: DotTone;
  text: string;
}

// The live sessions of a project or a blueprint, each leading to its detail on Sessions live.
export function LiveSessions({ items }: { items: LiveItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className={styles.live} aria-label={t("projects.sessions.label")}>
      {items.map((s) => (
        <li key={s.id}>
          <Link to={`/?session=${encodeURIComponent(s.id)}`} className={styles.liveLink}>
            <StatusDot tone={s.tone} />
            <span className={styles.liveText}>{s.text}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// The dots of the live sessions alone, for a card that is itself a button.
export function LiveDots({ items }: { items: LiveItem[] }) {
  return (
    <span className={styles.dots}>
      {items.map((s) => (
        <StatusDot key={s.id} tone={s.tone} />
      ))}
    </span>
  );
}

// projects FR-06: each count large, its label below.
export function Tiles({ tiles }: { tiles: { label: string; value: ReactNode; kind?: SpecKind }[] }) {
  return (
    <ul className={styles.tiles}>
      {tiles.map((tile) => (
        <li key={tile.label} className={styles.tile}>
          <span className={styles.tileValue}>
            {tile.kind && <SpecChip kind={tile.kind} />}
            {tile.value}
          </span>
          <span className={styles.tileLabel}>{tile.label}</span>
        </li>
      ))}
    </ul>
  );
}
