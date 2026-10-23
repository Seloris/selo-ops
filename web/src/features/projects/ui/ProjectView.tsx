import type { ReactNode } from "react";
import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { CommandBox } from "../../../shared/ui/CommandBox.tsx";
import { EmptyState } from "../../../shared/ui/EmptyState.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { BlueprintIcon, BranchIcon, GaugeIcon, NoteIcon, TextFileIcon, WarningIcon } from "../../../shared/ui/icons.tsx";
import { SpecChip } from "../../../shared/ui/SpecKind.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import {
  biggestSheet,
  blueprintLists,
  dateOf,
  isOpenBlueprint,
  sheetLists,
  type Blueprint,
  type ProjectOverview,
  type SpecSheet,
} from "../data/projectView.ts";
import { DeltaBar, HueChip, LiveSessions, ProgressTrack, SectionTitle, SizeBar, StateBar, StateTag, Tiles, type Hue, type LiveItem } from "./ProjectParts.tsx";
import styles from "./ProjectView.module.css";

export const IDEAS_FILE = ".planning/ideas.md";
export const DEBT_FILE = ".planning/technical-debt.md";

// projects FR-05 to FR-09: one project's view, in place of the cards.
export function ProjectView({
  project: p,
  openPath,
  liveOf,
  ageOf,
  onBack,
  onOpenFile,
  onCopy,
}: {
  project: ProjectOverview;
  // The file open in the panel, marked in the lists.
  openPath: string | null;
  liveOf: (ids: string[]) => LiveItem[];
  // « 3 h 05 » since an ISO date.
  ageOf: (iso: string) => string;
  onBack: () => void;
  onOpenFile: (path: string) => void;
  onCopy: (prompt: string) => void;
}) {
  const open = p.blueprints.filter(isOpenBlueprint);
  const { listed, legacy } = blueprintLists(p.blueprints);
  const { pages, domains } = sheetLists(p.sheets);
  const max = biggestSheet(p.sheets);
  const frs = p.sheets.reduce((n, s) => n + s.frCount, 0);
  const brs = p.sheets.reduce((n, s) => n + s.brCount, 0);
  const unknown = t("projects.view.unknown");
  const rowClass = (path: string) => `${styles.row} ${openPath === path ? styles.selected : ""}`;

  // One line per blueprint, its cells in columns shared by every row.
  const blueprintRow = (b: Blueprint) => (
    <li key={b.name}>
      <button type="button" className={`${rowClass(b.file)} ${styles.bpRow}`} onClick={() => onOpenFile(b.file)} aria-current={openPath === b.file || undefined}>
        <span className={styles.date}>{dateOf(b) ?? ""}</span>
        <span className={styles.rowTitle} title={b.title}>
          <SpecChip kind="blueprint" />
          <span className={styles.ellipsis}>{b.title}</span>
          {b.worktreeBranch && <Tag icon={<BranchIcon />}>{t("projects.worktree", { branch: b.worktreeBranch })}</Tag>}
        </span>
        <span className={styles.state}>
          <StateTag state={b.state} />
        </span>
        <span className={`${styles.sheets} ${styles.ellipsis}`} title={b.sheets.join(" · ")}>
          {b.sheets.join(" · ")}
        </span>
        <span className={styles.deltaCell}>
          <DeltaBar delta={b.delta} />
        </span>
        <span className={styles.trackCell}>
          <ProgressTrack blueprint={b} />
        </span>
      </button>
    </li>
  );

  // One line per sheet; the open blueprints touching it, when any, on a second line.
  const sheetRow = (s: SpecSheet) => {
    const commit = s.lastCommit && t("projects.specs.lastCommit", { subject: s.lastCommit.subject, age: ageOf(s.lastCommit.at) });
    return (
      <li key={s.file}>
        <button type="button" className={`${rowClass(s.file)} ${styles.sheetRow}`} onClick={() => onOpenFile(s.file)} aria-current={openPath === s.file || undefined}>
          <span className={styles.rowTitle} title={s.title}>
            <SpecChip kind={s.kind === "page" ? "page" : "domain"} />
            <span className={styles.ellipsis}>{s.title}</span>
            {s.route && <span className={styles.route}>{s.route}</span>}
          </span>
          <span className={styles.counts}>{t("projects.specs.counts", { fr: s.frCount, br: s.brCount })}</span>
          <span className={`${styles.commit} ${styles.ellipsis}`} title={commit ?? undefined}>
            {commit}
          </span>
          <span className={styles.sizeCell}>
            <SizeBar fr={s.frCount} br={s.brCount} max={max} />
          </span>
          {s.openBlueprints.length > 0 && (
            <span className={styles.touching}>
              {p.blueprints
                .filter((b) => s.openBlueprints.includes(b.name))
                .map((b) => (
                  <StateTag key={b.name} state={b.state} />
                ))}
              <span>{s.openBlueprints.join(" · ")}</span>
            </span>
          )}
        </button>
      </li>
    );
  };

  const noteRow = (path: string, icon: ReactNode, hue: Hue, title: string, count: number, empty: string) => (
    <li key={path}>
      <button type="button" className={`${rowClass(path)} ${styles.sheetRow}`} onClick={() => onOpenFile(path)} aria-current={openPath === path || undefined}>
        <span className={styles.rowTitle}>
          <HueChip icon={icon} hue={hue} />
          <span className={styles.ellipsis}>{title}</span>
        </span>
        <span className={styles.noteCount}>{count > 0 ? tn("projects.specs.items", count) : empty}</span>
      </button>
    </li>
  );

  return (
    <div className={styles.view}>
      <div className={styles.head}>
        <div className={styles.titleLine}>
          <Button size="sm" onClick={onBack}>
            ← {t("projects.view.back")}
          </Button>
          <h2 className={styles.name}>{p.name}</h2>
        </div>
        {/* Each fact a label and its value, side by side, wrapping as a whole. */}
        <dl className={styles.facts}>
          <div>
            <dt>{t("projects.view.folder")}</dt>
            <dd className={styles.mono}>{p.root}</dd>
          </div>
          <div>
            <dt>{t("projects.view.branch")}</dt>
            <dd className={styles.mono}>{p.branch ?? unknown}</dd>
          </div>
          <div>
            <dt>{t("projects.view.baseBranch")}</dt>
            <dd className={styles.mono}>{p.baseBranch ?? unknown}</dd>
          </div>
          <div>
            <dt>{t("projects.view.selo")}</dt>
            <dd className={styles.mono}>{p.seloVersion ?? unknown}</dd>
          </div>
          <div>
            <dt>{t("projects.view.git")}</dt>
            <dd>
              {tn("projects.card.changed", p.changedCount ?? 0)} · {tn("projects.card.unpushed", p.unpushedCount ?? 0)}
            </dd>
          </div>
          <div>
            <dt>{t("projects.view.worktrees")}</dt>
            <dd>
              {p.worktrees.length === 0 ? (
                t("projects.view.noWorktree")
              ) : (
                <ul className={styles.worktrees}>
                  {p.worktrees.map((w) => (
                    <li key={w.root}>
                      <span className={styles.mono}>{w.branch ?? unknown}</span>
                      {w.aheadCount !== null && <span className={styles.muted}> · {tn("projects.view.ahead", w.aheadCount)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
        {p.error && (
          <ErrorMessage>
            {t("projects.view.error")} : {p.error}
          </ErrorMessage>
        )}
        <LiveSessions items={liveOf(p.sessionIds)} />
      </div>

      <Tiles
        tiles={[
          { label: t("projects.tiles.open"), value: `${open.length} / ${p.blueprints.length}`, kind: "blueprint" },
          { label: t("projects.tiles.pages"), value: pages.length, kind: "page" },
          { label: t("projects.tiles.domains"), value: domains.length, kind: "domain" },
          { label: t("projects.tiles.frs"), value: frs },
          { label: t("projects.tiles.brs"), value: brs },
          { label: t("projects.tiles.ideas"), value: p.ideaCount },
          { label: t("projects.tiles.debt"), value: p.debtCount },
        ]}
      />

      <section className={styles.section}>
        <SectionTitle icon={<GaugeIcon />} hue="progress" title={t("projects.progress.title")} count={open.length} />
        {p.blueprints.length === 0 ? (
          <EmptyState>{t("projects.empty.blueprints")}</EmptyState>
        ) : (
          <>
            <StateBar blueprints={p.blueprints} withLegend />
            {open.length === 0 ? (
              <EmptyState>{t("projects.empty.open")}</EmptyState>
            ) : (
              <ul className={styles.openList}>
                {open.map((b) => (
                  <li key={b.name} className={styles.openItem}>
                    <button type="button" className={styles.openTitle} onClick={() => onOpenFile(b.file)}>
                      <SpecChip kind="blueprint" />
                      {b.title}
                    </button>
                    <span className={styles.rowMeta}>
                      <StateTag state={b.state} />
                      {b.worktreeBranch && <Tag icon={<BranchIcon />}>{t("projects.worktree", { branch: b.worktreeBranch })}</Tag>}
                    </span>
                    <ProgressTrack blueprint={b} />
                    <LiveSessions items={liveOf(b.sessionIds)} />
                    {b.nextPrompt && <CommandBox command={b.nextPrompt} copyLabel={t("projects.next.copy")} onCopy={() => onCopy(b.nextPrompt ?? "")} />}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className={styles.section}>
        <SectionTitle icon={<BlueprintIcon />} hue="blueprints" title={t("projects.blueprints.title")} count={listed.length} />
        {p.blueprints.length === 0 ? (
          <EmptyState>{t("projects.empty.blueprints")}</EmptyState>
        ) : (
          <>
            <ul className={styles.rows}>{listed.map(blueprintRow)}</ul>
            {legacy.length > 0 && (
              <details className={styles.legacy}>
                <summary>{tn("projects.blueprints.legacy", legacy.length)}</summary>
                <ul className={styles.rows}>{legacy.map(blueprintRow)}</ul>
              </details>
            )}
          </>
        )}
      </section>

      <section className={styles.section}>
        <SectionTitle icon={<TextFileIcon />} hue="specs" title={t("projects.specs.title")} count={p.sheets.length} />
        {p.sheets.length === 0 && <EmptyState>{t("projects.empty.specs")}</EmptyState>}
        {pages.length > 0 && (
          <>
            <h4 className={styles.group}>
              <SpecChip kind="page" />
              {t("projects.specs.pages")}
            </h4>
            <ul className={styles.rows}>{pages.map(sheetRow)}</ul>
          </>
        )}
        {domains.length > 0 && (
          <>
            <h4 className={styles.group}>
              <SpecChip kind="domain" />
              {t("projects.specs.domains")}
            </h4>
            <ul className={styles.rows}>{domains.map(sheetRow)}</ul>
          </>
        )}
        <ul className={styles.rows}>
          {noteRow(IDEAS_FILE, <NoteIcon />, "ideas", t("projects.specs.ideas"), p.ideaCount, t("projects.empty.ideas"))}
          {noteRow(DEBT_FILE, <WarningIcon />, "debt", t("projects.specs.debt"), p.debtCount, t("projects.empty.debt"))}
        </ul>
      </section>
    </div>
  );
}
