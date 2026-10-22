import { t } from "../../../shared/lib/i18n/index.ts";
import { Checkbox } from "../../../shared/ui/Checkbox.tsx";
import { Dropdown, DropdownCheck, DropdownSeparator } from "../../../shared/ui/Dropdown.tsx";
import { IconButton } from "../../../shared/ui/IconButton.tsx";
import { CloseIcon, GridIcon, ListIcon } from "../../../shared/ui/icons.tsx";
import { SearchInput } from "../../../shared/ui/SearchInput.tsx";
import { Segmented } from "../../../shared/ui/Segmented.tsx";
import type { Grouping, Project } from "../data/sessionView.ts";
import styles from "./SettingsBar.module.css";

export type View = "list" | "cards";

export interface ProjectItem {
  project: Project;
  openCount: number;
}

// sessions-live FR-03 to FR-07.
export function SettingsBar({
  view,
  onView,
  grouping,
  onGrouping,
  projects,
  projectIds,
  onToggleProject,
  onAllProjects,
  isProjectsOpen,
  onToggleProjects,
  onCloseProjects,
  showClosed,
  closedCount,
  onShowClosed,
  search,
  onSearch,
}: {
  view: View;
  onView: (view: View) => void;
  grouping: Grouping;
  onGrouping: (grouping: Grouping) => void;
  projects: ProjectItem[];
  projectIds: Set<string> | null;
  onToggleProject: (id: string) => void;
  onAllProjects: () => void;
  isProjectsOpen: boolean;
  onToggleProjects: () => void;
  onCloseProjects: () => void;
  showClosed: boolean;
  closedCount: number;
  onShowClosed: (show: boolean) => void;
  search: string;
  onSearch: (search: string) => void;
}) {
  const checked = projects.filter((p) => projectIds === null || projectIds.has(p.project.id));
  const projectsLabel =
    projectIds === null
      ? t("sessions.settings.projectsAll")
      : checked.length === 0
        ? t("sessions.settings.projectsNone")
        : checked.length === 1
          ? (checked[0]?.project.name ?? "")
          : t("sessions.settings.projectsSome", { count: checked.length });
  const allOpen = projects.reduce((n, p) => n + p.openCount, 0);

  return (
    <div className={styles.bar}>
      <div className={styles.control}>
        <span className={styles.label}>{t("sessions.settings.view")}</span>
        <Segmented
          label={t("sessions.settings.view")}
          value={view}
          onChange={onView}
          options={[
            { value: "list", label: t("sessions.settings.viewList"), icon: <ListIcon /> },
            { value: "cards", label: t("sessions.settings.viewCards"), icon: <GridIcon /> },
          ]}
        />
      </div>
      <div className={styles.control}>
        <span className={styles.label}>{t("sessions.settings.group")}</span>
        <Segmented
          label={t("sessions.settings.group")}
          value={grouping}
          onChange={onGrouping}
          options={[
            { value: "project", label: t("sessions.settings.groupProject") },
            { value: "status", label: t("sessions.settings.groupStatus") },
            { value: "none", label: t("sessions.settings.groupNone") },
          ]}
        />
      </div>
      <Dropdown
        trigger={
          <>
            <span className={styles.label}>{t("sessions.settings.projects")}</span>
            {projectsLabel}
          </>
        }
        isOpen={isProjectsOpen}
        onToggle={onToggleProjects}
        onClose={onCloseProjects}
        closeLabel={t("sessions.settings.projectsClose")}
        panelLabel={t("sessions.settings.projectsPanel")}
      >
        <DropdownCheck label={t("sessions.settings.projectsAll")} count={allOpen} isChecked={projectIds === null} onChange={onAllProjects} />
        <DropdownSeparator />
        {projects.map((p) => (
          <DropdownCheck
            key={p.project.id}
            label={p.project.name}
            count={p.openCount}
            isChecked={projectIds === null || projectIds.has(p.project.id)}
            onChange={() => onToggleProject(p.project.id)}
          />
        ))}
      </Dropdown>
      <label className={`${styles.check} ${showClosed ? styles.on : ""}`}>
        <Checkbox checked={showClosed} onChange={(e) => onShowClosed(e.target.checked)} />
        {t("sessions.settings.showClosed")}
        <span className={styles.label}>{t("sessions.settings.closedCount", { count: closedCount })}</span>
      </label>
      <div className={styles.search}>
        <SearchInput
          placeholder={t("sessions.settings.search")}
          aria-label={t("sessions.settings.searchLabel")}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        {search && (
          <span className={styles.clear}>
            <IconButton label={t("sessions.settings.searchClear")} onClick={() => onSearch("")}>
              <CloseIcon />
            </IconButton>
          </span>
        )}
      </div>
    </div>
  );
}
