import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { BranchIcon } from "../../../shared/ui/icons.tsx";
import { SpecChip } from "../../../shared/ui/SpecKind.tsx";
import { Tag } from "../../../shared/ui/Tag.tsx";
import type { ProjectOverview } from "../data/projectView.ts";
import { LiveDots, StateBar, type LiveItem } from "./ProjectParts.tsx";
import styles from "./ProjectCards.module.css";

// projects FR-02 and FR-03: one card per project; a project with no selo planning dimmed, not opening.
export function ProjectCards({
  projects,
  liveOf,
  onOpen,
}: {
  projects: ProjectOverview[];
  liveOf: (p: ProjectOverview) => LiveItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <ul className={styles.grid}>
      {projects.map((p) => {
        const live = liveOf(p);
        const git = (
          <span className={styles.git}>
            {p.branch && (
              <span className={styles.branch}>
                <BranchIcon />
                {p.branch}
              </span>
            )}
            <span>{tn("projects.card.changed", p.changedCount ?? 0)}</span>
            <span>{tn("projects.card.unpushed", p.unpushedCount ?? 0)}</span>
          </span>
        );
        if (!p.hasPlanning) {
          return (
            <li key={p.id} className={`${styles.card} ${styles.dimmed}`}>
              <span className={styles.head}>
                <span className={styles.name}>{p.name}</span>
                <Tag>{t("projects.card.noPlanning")}</Tag>
              </span>
              {git}
            </li>
          );
        }
        const pages = p.sheets.filter((s) => s.kind === "page").length;
        return (
          <li key={p.id}>
            <button type="button" className={styles.card} onClick={() => onOpen(p.id)}>
              <span className={styles.head}>
                <span className={styles.name}>{p.name}</span>
                {live.length > 0 && (
                  <span className={styles.live} title={tn("projects.card.sessions", live.length)}>
                    <LiveDots items={live} />
                    {tn("projects.card.sessions", live.length)}
                  </span>
                )}
              </span>
              {git}
              <span className={styles.counts}>
                <span className={styles.count}>
                  <SpecChip kind="page" />
                  {tn("projects.card.pages", pages)}
                </span>
                <span className={styles.count}>
                  <SpecChip kind="domain" />
                  {tn("projects.card.domains", p.sheets.length - pages)}
                </span>
                <span className={styles.count}>
                  <SpecChip kind="blueprint" />
                  {tn("projects.card.blueprints", p.blueprints.length)}
                </span>
              </span>
              <StateBar blueprints={p.blueprints} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
