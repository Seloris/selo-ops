import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { copyText } from "../../../shared/lib/clipboard.ts";
import { t } from "../../../shared/lib/i18n/index.ts";
import { readStored, writeStored } from "../../../shared/lib/storage.ts";
import { useTheme } from "../../../shared/lib/theme.ts";
import { useNow } from "../../../shared/lib/useNow.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { Drawer } from "../../../shared/ui/Drawer.tsx";
import { EmptyState } from "../../../shared/ui/EmptyState.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import { Toast } from "../../../shared/ui/Toast.tsx";
import {
  archivedSessions,
  closedSessions,
  countsOf,
  groupSessions,
  openCountByProject,
  type Block,
  type Filters,
  type Grouping,
  type Project,
  type Session,
} from "../data/sessionView.ts";
import { useArchiveSessionMutation } from "../data/useArchiveSessionMutation.ts";
import { useSessionsQuery } from "../data/useSessionsQuery.ts";
import { useUnarchiveSessionMutation } from "../data/useUnarchiveSessionMutation.ts";
import { BlockedCommand } from "../ui/BlockedCommand.tsx";
import { SessionCards } from "../ui/SessionCards.tsx";
import { SessionDetail } from "../ui/SessionDetail.tsx";
import { ArchivedToggle, ClosedHeader, ProjectHeader, SessionGroup, StatusHeader } from "../ui/SessionGroup.tsx";
import { ColumnHead, SessionList, type SessionActions } from "../ui/SessionList.tsx";
import { SessionsHeader } from "../ui/SessionsHeader.tsx";
import { SettingsBar, type View } from "../ui/SettingsBar.tsx";
import { laneLabel, resumeCommand } from "../ui/sessionText.ts";
import styles from "./SessionsLivePage.module.css";

// sessions-live FR-08: the view and the grouping are remembered in the browser.
const SETTINGS_KEY = "selo-ops/sessions-live/settings";
interface Settings {
  view: View;
  grouping: Grouping;
}

function readSettings(): Settings {
  const raw = readStored(SETTINGS_KEY);
  const o = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    view: o.view === "cards" ? "cards" : "list",
    grouping: o.grouping === "status" || o.grouping === "none" ? o.grouping : "project",
  };
}

interface ToastState {
  title: string;
  hint?: string;
  // A command the browser refused to copy: shown selected, to copy by hand.
  blockedCommand?: string;
}

export function SessionsLivePage() {
  const query = useSessionsQuery();
  const archive = useArchiveSessionMutation();
  const unarchive = useUnarchiveSessionMutation();
  const [theme, setTheme] = useTheme();
  const now = useNow(1000);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("session");

  const [settings, setSettings] = useState(readSettings);
  const [projectIds, setProjectIds] = useState<Set<string> | null>(null);
  const [isProjectsOpen, setProjectsOpen] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState("");
  const [isArchivedOpen, setArchivedOpen] = useState(false);
  const [nextShown, setNextShown] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<ToastState | null>(null);

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeStored(SETTINGS_KEY, next);
  };

  const sessions = useMemo(() => query.data?.sessions ?? [], [query.data]);
  const projects = useMemo(() => query.data?.projects ?? [], [query.data]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const projectName = useCallback((id: string) => projectsById.get(id)?.name ?? id, [projectsById]);
  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  const closeDetail = useCallback(() => {
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.delete("session");
      return next;
    });
  }, [setParams]);

  // Échap closes the projects' list first, then the detail.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isProjectsOpen) setProjectsOpen(false);
      else if (selectedId) closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isProjectsOpen, selectedId, closeDetail]);

  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((next: ToastState) => {
    window.clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = window.setTimeout(() => setToast(null), next.blockedCommand ? 14_000 : 6_000);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const copy = async (command: string, title: string, hint: string) => {
    const isCopied = await copyText(command);
    showToast(isCopied ? { title, hint } : { title: t("sessions.toast.copyBlocked"), hint, blockedCommand: command });
  };

  const failed = (error: Error) => showToast({ title: t("sessions.toast.failed"), hint: error.message || t("sessions.toast.failedUnknown") });

  const actions: SessionActions = {
    onOpen: (id) => {
      setProjectsOpen(false);
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.set("session", id);
        return next;
      });
    },
    onResume: (s) => void copy(resumeCommand(s), t("sessions.toast.resumeCopied"), t("sessions.toast.resumeHint", { folder: s.folder })),
    onToggleNext: (id) =>
      setNextShown((shown) => {
        const next = new Set(shown);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    onCopyNext: (s) =>
      void copy(s.nextAction ?? "", t("sessions.toast.nextCopied"), t("sessions.toast.nextHint", { project: projectName(s.projectId), lane: laneLabel(s.lane) })),
    onArchive: (id) =>
      archive.mutate(id, { onSuccess: () => showToast({ title: t("sessions.toast.archived"), hint: t("sessions.toast.archivedHint") }), onError: failed }),
    onUnarchive: (id) =>
      unarchive.mutate(id, { onSuccess: () => showToast({ title: t("sessions.toast.unarchived"), hint: t("sessions.toast.unarchivedHint") }), onError: failed }),
  };

  const toggleProject = (id: string) => {
    const current = projectIds ?? new Set(projects.map((p) => p.id));
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    setProjectIds(next.size === projects.length ? null : next);
  };

  const filters: Filters = { projectIds, search };
  const counts = query.data ? countsOf(sessions) : null;
  const openByProject = openCountByProject(sessions);
  const blocks = groupSessions(sessions, settings.grouping, filters, projectsById);
  const closed = closedSessions(sessions, filters, projectsById);
  const closedTotal = sessions.filter((s) => s.isClosed && !s.isArchived).length;
  const archived = archivedSessions(sessions, filters, projectsById);
  const hasArchives = sessions.some((s) => s.isArchived);
  const isList = settings.view === "list";
  const isPanelOpen = selected !== null;

  const renderSessions = (list: Session[], showProject: boolean) =>
    isList ? (
      <SessionList sessions={list} showProject={showProject} isNarrow={isPanelOpen} projectName={projectName} now={now} selectedId={selectedId} actions={actions} />
    ) : (
      <SessionCards sessions={list} showProject={showProject} projectName={projectName} now={now} selectedId={selectedId} nextShown={nextShown} actions={actions} />
    );

  const blockHeader = (b: Block, project: Project | undefined) => {
    if (b.kind === "project" && project) return <ProjectHeader project={project} count={b.sessions.length} todoCount={b.todoCount} />;
    if (b.kind === "status") return <StatusHeader bucket={b.key as "todo" | "run" | "rest"} count={b.sessions.length} />;
    return null;
  };

  const emptyText =
    projectIds !== null && projectIds.size === 0
      ? t("sessions.empty.noProject")
      : search.trim()
        ? t("sessions.empty.noMatch", { search: search.trim() })
        : t("sessions.empty.none");

  const updatedSeconds = query.dataUpdatedAt ? Math.max(0, Math.floor((now - query.dataUpdatedAt) / 1000)) : null;

  return (
    <div className={`${styles.app} ${isPanelOpen ? styles.withPanel : ""}`}>
      <SessionsHeader counts={counts} updatedSeconds={updatedSeconds} isRefreshing={query.isFetching} theme={theme} onTheme={setTheme} />
      <SettingsBar
        view={settings.view}
        onView={(view) => updateSettings({ view })}
        grouping={settings.grouping}
        onGrouping={(grouping) => updateSettings({ grouping })}
        projects={projects.map((p) => ({ project: p, openCount: openByProject.get(p.id) ?? 0 }))}
        projectIds={projectIds}
        onToggleProject={toggleProject}
        onAllProjects={() => setProjectIds(null)}
        isProjectsOpen={isProjectsOpen}
        onToggleProjects={() => setProjectsOpen((o) => !o)}
        onCloseProjects={() => setProjectsOpen(false)}
        showClosed={showClosed}
        closedCount={closedTotal}
        onShowClosed={setShowClosed}
        search={search}
        onSearch={setSearch}
      />
      <div className={styles.body}>
        <main className={styles.content}>
          {query.isPending ? (
            <LoadingState>{t("sessions.page.loading")}</LoadingState>
          ) : query.isError && !query.data ? (
            <div className={styles.error}>
              <ErrorMessage>{t("sessions.page.error", { message: query.error.message || t("sessions.page.errorUnknown") })}</ErrorMessage>
              <Button size="sm" onClick={() => void query.refetch()}>
                {t("sessions.page.retry")}
              </Button>
            </div>
          ) : (
            <>
              {query.isError && <ErrorMessage>{t("sessions.page.refreshError", { message: query.error.message || t("sessions.page.errorUnknown") })}</ErrorMessage>}
              {isList && <ColumnHead showProject={settings.grouping !== "project"} isNarrow={isPanelOpen} />}
              {blocks.length === 0 && <EmptyState>{emptyText}</EmptyState>}
              {blocks.map((b) => (
                <SessionGroup key={b.key} header={blockHeader(b, projectsById.get(b.key))}>
                  {renderSessions(b.sessions, b.kind !== "project")}
                </SessionGroup>
              ))}
              {showClosed && closed.length > 0 && (
                <SessionGroup header={<ClosedHeader count={closed.length} />}>{renderSessions(closed, true)}</SessionGroup>
              )}
              {hasArchives && (
                <SessionGroup
                  isFlat={!isArchivedOpen || archived.length === 0}
                  header={<ArchivedToggle count={archived.length} isOpen={isArchivedOpen} onToggle={() => setArchivedOpen((o) => !o)} />}
                >
                  {isArchivedOpen && archived.length > 0 && renderSessions(archived, true)}
                </SessionGroup>
              )}
            </>
          )}
        </main>
        <Drawer isOpen={isPanelOpen} label={t("sessions.detail.label")}>
          {selected && (
            <SessionDetail
              session={selected}
              projectName={projectName(selected.projectId)}
              now={now}
              isNextOpen={nextShown.has(selected.id)}
              actions={actions}
              onClose={closeDetail}
            />
          )}
        </Drawer>
      </div>
      {toast && (
        <Toast title={toast.title} closeLabel={t("app.toast.close")} onClose={() => setToast(null)}>
          {toast.blockedCommand && <BlockedCommand command={toast.blockedCommand} />}
          {toast.hint && <span className={styles.hint}>{toast.hint}</span>}
        </Toast>
      )}
    </div>
  );
}

