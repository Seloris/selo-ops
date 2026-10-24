import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router";
import { useSessionFlags } from "../../../shared/lib/flags.ts";
import { copyText } from "../../../shared/lib/clipboard.ts";
import { t } from "../../../shared/lib/i18n/index.ts";
import { readStored, writeStored } from "../../../shared/lib/storage.ts";
import { useNow } from "../../../shared/lib/useNow.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog.tsx";
import { Drawer, type DrawerResize } from "../../../shared/ui/Drawer.tsx";
import { EmptyState } from "../../../shared/ui/EmptyState.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import { OpenIcon } from "../../../shared/ui/icons.tsx";
import { Toast, type ToastTone } from "../../../shared/ui/Toast.tsx";
import {
  archivedSessions,
  closedSessions,
  countsOf,
  groupSessions,
  isFinished,
  isOpen,
  openCountByProject,
  type Block,
  type Bucket,
  type Filters,
  type Grouping,
  type Project,
  type Session,
} from "../data/sessionView.ts";
import { useArchiveSessionMutation } from "../data/useArchiveSessionMutation.ts";
import { useSessionsQuery } from "../data/useSessionsQuery.ts";
import { useSaveNoteMutation } from "../data/useSaveNoteMutation.ts";
import { useUnarchiveSessionMutation } from "../data/useUnarchiveSessionMutation.ts";
import { useProjectsQuery } from "../../projects/data/useProjectsQuery.ts";
import { BlockedCommand } from "../ui/BlockedCommand.tsx";
import { NewSessionDialog } from "../ui/NewSessionDialog.tsx";
import { newSessionLink, type ProjectOverview } from "../ui/newSession.ts";
import { SessionCards } from "../ui/SessionCards.tsx";
import { parseFoldedSections, toggleSection, type FoldedSections } from "../ui/detailSections.ts";
import { SessionDetail } from "../ui/SessionDetail.tsx";
import { NoteDialog } from "../ui/NoteDialog.tsx";
import { NoteText } from "../ui/SessionBits.tsx";
import { ArchivedToggle, ClosedHeader, ProjectHeader, SessionGroup, StatusHeader } from "../ui/SessionGroup.tsx";
import { SessionList, type SessionActions } from "../ui/SessionList.tsx";
import { SessionsHeader } from "../ui/SessionsHeader.tsx";
import { SettingsBar, type View } from "../ui/SettingsBar.tsx";
import { MIN_PANEL_WIDTH, PANEL_WIDTH_STEP, clampPanelWidth, parsePanelWidth } from "../ui/panelWidth.ts";
import { desktopLinkOf, metaText, workLabel, outdatedIdsOf, pluginsText, resumeCommand, stateLabel } from "../ui/sessionText.ts";
import styles from "./SessionsLivePage.module.css";

// sessions-live FR-08, FR-27 and FR-31: the view, the grouping, the detail's width and its folded sections are
// remembered in the browser.
const SETTINGS_KEY = "selo-ops/sessions-live/settings";
interface Settings {
  view: View;
  grouping: Grouping;
  panelWidth: number | null;
  foldedSections: FoldedSections;
  // The unchecked projects, not the checked ones: a project that appears later shows by default.
  hiddenProjectIds: string[];
}

function readSettings(): Settings {
  const raw = readStored(SETTINGS_KEY);
  const o = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    view: o.view === "cards" ? "cards" : "list",
    grouping: o.grouping === "status" || o.grouping === "none" ? o.grouping : "project",
    panelWidth: parsePanelWidth(o.panelWidth),
    foldedSections: parseFoldedSections(o.foldedSections),
    hiddenProjectIds: Array.isArray(o.hiddenProjectIds) ? o.hiddenProjectIds.filter((id): id is string => typeof id === "string") : [],
  };
}

interface ToastState {
  // A new id per message: the toast restarts its entrance and its timer.
  id: number;
  title: string;
  tone?: ToastTone;
  // The desktop app opened the session: the open icon instead of the check.
  isOpened?: boolean;
  hint?: string;
  // A command the browser refused to copy: shown selected, to copy by hand.
  blockedCommand?: string;
  // sessions-live FR-46: the new session's link, opened again by « Rouvrir ».
  reopenLink?: string;
}

// sessions-live FR-20 and FR-46: a link click, not a page navigation, so a browser with no handler for `claude://`
// keeps the dashboard.
function openLink(link: string) {
  const anchor = document.createElement("a");
  anchor.href = link;
  anchor.click();
}

export function SessionsLivePage() {
  const query = useSessionsQuery();
  const flags = useSessionFlags();
  const archive = useArchiveSessionMutation();
  const unarchive = useUnarchiveSessionMutation();
  const saveNote = useSaveNoteMutation();
  const now = useNow(1000);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("session");

  const [settings, setSettings] = useState(readSettings);
  const [isProjectsOpen, setProjectsOpen] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState("");
  const [isArchivedOpen, setArchivedOpen] = useState(false);
  const [nextShown, setNextShown] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  // sessions-live FR-28: the session whose archive waits for the person's confirmation.
  const [archiveAsked, setArchiveAsked] = useState<Session | null>(null);
  // sessions-live FR-40: the session whose note is being written.
  const [noteFor, setNoteFor] = useState<Session | null>(null);
  // sessions-live FR-43: the « Nouvelle session » window, open on the project holding this folder (null: the first).
  const [newSession, setNewSession] = useState<{ folder: string | null } | null>(null);
  const projectsQuery = useProjectsQuery({ enabled: newSession !== null });
  const isDialogOpen = noteFor !== null || archiveAsked !== null || newSession !== null;

  const [isResizing, setResizing] = useState(false);
  // sessions-live FR-37: the detail alone on the screen, header and settings hidden, the browser in full screen
  // when it allows it; not remembered.
  const [isFullscreen, setFullscreen] = useState(false);

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeStored(SETTINGS_KEY, next);
  };

  // sessions-live FR-27: while the edge moves, the width goes straight to the page's style (no re-render
  // of the list per pixel); once it stops, it becomes a setting, stored. A double click goes back to the default.
  const appRef = useRef<HTMLDivElement>(null);
  const panelResize: DrawerResize = {
    label: t("sessions.detail.resize"),
    min: MIN_PANEL_WIDTH,
    max: clampPanelWidth(Number.POSITIVE_INFINITY, window.innerWidth),
    step: PANEL_WIDTH_STEP,
    onResize: (width) => {
      appRef.current?.style.setProperty("--drawer-chosen-w", `${clampPanelWidth(width, window.innerWidth)}px`);
      setResizing(true);
    },
    onResizeEnd: (width) => {
      setResizing(false);
      updateSettings({ panelWidth: clampPanelWidth(width, window.innerWidth) });
    },
    onReset: () => {
      setResizing(false);
      updateSettings({ panelWidth: null });
    },
  };

  const sessions = useMemo(() => query.data?.sessions ?? [], [query.data]);
  const projects = useMemo(() => query.data?.projects ?? [], [query.data]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const projectName = useCallback((id: string) => projectsById.get(id)?.name ?? id, [projectsById]);
  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  const closeDetail = useCallback(() => {
    setFullscreen(false);
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.delete("session");
      return next;
    });
  }, [setParams]);

  // The browser's own Échap leaves its full screen: the page follows. And the other way round.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (!isFullscreen && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [isFullscreen]);
  const toggleFullscreen = () => {
    if (isFullscreen) return setFullscreen(false);
    setFullscreen(true);
    // Refused (or unsupported): the page still hides its header and settings.
    void appRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  // Échap closes the projects' list first, then leaves the full screen, then closes the detail; an open dialog
  // takes it for itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isDialogOpen) return;
      if (isProjectsOpen) setProjectsOpen(false);
      else if (isFullscreen) setFullscreen(false);
      else if (selectedId) closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isProjectsOpen, isFullscreen, selectedId, closeDetail, isDialogOpen]);

  const toastId = useRef(0);
  const showToast = useCallback((next: Omit<ToastState, "id">) => {
    toastId.current += 1;
    setToast({ ...next, id: toastId.current });
  }, []);

  const copy = async (command: string, title: string, hint: string) => {
    const isCopied = await copyText(command);
    showToast(isCopied ? { title, hint } : { title: t("sessions.toast.copyBlocked"), hint, tone: "warn", blockedCommand: command });
  };

  const failed = (error: Error) => showToast({ title: t("sessions.toast.failed"), hint: error.message || t("sessions.toast.failedUnknown"), tone: "danger" });

  const archiveNow = (id: string) =>
    archive.mutate(id, {
      onSuccess: () => {
        setArchiveAsked(null);
        showToast({ title: t("sessions.toast.archived"), hint: t("sessions.toast.archivedHint") });
      },
      onError: failed,
    });

  const actions: SessionActions = {
    onOpen: (id) => {
      setProjectsOpen(false);
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.set("session", id);
        return next;
      });
    },
    onResume: (s) => {
      // sessions-live FR-20: a desktop-app session opens in the app, any other gets its resume command.
      const link = desktopLinkOf(s);
      if (!link) {
        void copy(resumeCommand(s), t("sessions.toast.resumeCopied"), t("sessions.toast.resumeHint", { folder: s.folder }));
        return;
      }
      openLink(link);
      showToast({ title: t("sessions.toast.desktopOpening"), isOpened: true });
    },
    onToggleNext: (id) =>
      setNextShown((shown) => {
        const next = new Set(shown);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    onCopyNext: (s) =>
      void copy(s.nextAction ?? "", t("sessions.toast.nextCopied"), t("sessions.toast.nextHint", { project: projectName(s.projectId), lane: workLabel(s) })),
    onArchive: (s) => {
      // sessions-live FR-22: a finished session archives at once, unless it holds a note.
      if (isFinished(s) && !s.note) archiveNow(s.id);
      else setArchiveAsked(s);
    },
    onUnarchive: (id) =>
      unarchive.mutate(id, { onSuccess: () => showToast({ title: t("sessions.toast.unarchived"), hint: t("sessions.toast.unarchivedHint") }), onError: failed }),
    onEditNote: (s) => {
      saveNote.reset();
      setNoteFor(s);
    },
    flags,
  };

  // The checked projects; null while none is unchecked (every project, the ones to come included).
  const hidden = new Set(settings.hiddenProjectIds);
  const projectIds = projects.some((p) => hidden.has(p.id)) ? new Set(projects.filter((p) => !hidden.has(p.id)).map((p) => p.id)) : null;

  const toggleProject = (id: string) => {
    const next = new Set(settings.hiddenProjectIds);
    if (!next.delete(id)) next.add(id);
    updateSettings({ hiddenProjectIds: [...next] });
  };

  const filters: Filters = { projectIds, search };
  const counts = query.data ? countsOf(sessions) : null;
  const openByProject = openCountByProject(sessions);
  const outdatedIds = outdatedIdsOf(sessions, query.data?.plugins ?? []);
  const blocks = groupSessions(sessions, settings.grouping, filters, projectsById);
  const closed = closedSessions(sessions, filters, projectsById);
  const closedTotal = sessions.filter((s) => s.isClosed && !s.isArchived).length;
  const archived = archivedSessions(sessions, filters, projectsById);
  const hasArchives = sessions.some((s) => s.isArchived);
  const isList = settings.view === "list";
  const isPanelOpen = selected !== null;
  const shownLists = [...blocks.map((b) => ({ list: b.sessions, showProject: b.kind !== "project" })), { list: closed, showProject: true }, { list: archived, showProject: true }];
  const metaChars = Math.max(0, ...shownLists.flatMap(({ list, showProject }) => list.map((s) => metaText(s, showProject ? projectName(s.projectId) : null).length)));

  const renderSessions = (list: Session[], showProject: boolean) =>
    isList ? (
      <SessionList sessions={list} showProject={showProject} isNarrow={isPanelOpen} metaChars={metaChars} projectName={projectName} now={now} selectedId={selectedId} outdatedIds={outdatedIds} actions={actions} />
    ) : (
      <SessionCards sessions={list} showProject={showProject} projectName={projectName} now={now} selectedId={selectedId} nextShown={nextShown} outdatedIds={outdatedIds} actions={actions} />
    );

  // sessions-live FR-46: the command copied as well, in case the desktop app opens with an empty field.
  const openNewSession = async (command: string, project: ProjectOverview, folder: string) => {
    const isCopied = await copyText(command);
    const link = newSessionLink(command, folder);
    setNewSession(null);
    openLink(link);
    showToast({
      title: t("sessions.toast.newOpening", { project: project.name }),
      hint: t(isCopied ? "sessions.toast.newOpeningHint" : "sessions.toast.newOpeningNoCopy"),
      isOpened: true,
      reopenLink: link,
    });
  };

  // sessions-live FR-43: the header's button opens on the project of the most recently updated open session; one
  // outside selo has no project the export holds.
  const latestFolder = sessions.filter((s) => isOpen(s) && !s.isOutsideSelo).reduce<Session | null>((latest, s) => (latest === null || s.updatedAt > latest.updatedAt ? s : latest), null)?.folder ?? null;

  const blockHeader = (b: Block, project: Project | undefined) => {
    if (b.kind === "project" && project) {
      // sessions-live FR-12: a block only sessions outside selo show has no project the export holds, so no « + ».
      const selo = b.sessions.find((s) => !s.isOutsideSelo);
      return (
        <ProjectHeader
          project={project}
          count={b.sessions.length}
          todoCount={b.todoCount}
          onNewSession={selo ? () => setNewSession({ folder: selo.folder }) : undefined}
        />
      );
    }
    if (b.kind === "status") return <StatusHeader bucket={b.key as Bucket} count={b.sessions.length} />;
    return null;
  };

  const emptyText =
    projectIds !== null && projectIds.size === 0
      ? t("sessions.empty.noProject")
      : search.trim()
        ? t("sessions.empty.noMatch", { search: search.trim() })
        : t("sessions.empty.none");

  const isOnlyDetail = isPanelOpen && isFullscreen;
  const updatedSeconds = query.dataUpdatedAt ? Math.max(0, Math.floor((now - query.dataUpdatedAt) / 1000)) : null;

  return (
    <div
      ref={appRef}
      className={`${styles.app} ${isPanelOpen ? styles.withPanel : ""} ${isOnlyDetail ? styles.fullscreen : ""} ${settings.panelWidth !== null || isResizing ? styles.sized : ""} ${isResizing ? styles.resizing : ""}`}
      style={settings.panelWidth !== null ? ({ "--drawer-chosen-w": `${settings.panelWidth}px` } as CSSProperties) : undefined}
    >
      {!isOnlyDetail && (
        <SessionsHeader
          counts={counts}
          updatedSeconds={updatedSeconds}
          isRefreshing={query.isFetching}
          plugins={pluginsText(query.data?.plugins ?? [])}
          onNewSession={() => setNewSession({ folder: latestFolder })}
        />
      )}
      {!isOnlyDetail && <SettingsBar
        view={settings.view}
        onView={(view) => updateSettings({ view })}
        grouping={settings.grouping}
        onGrouping={(grouping) => updateSettings({ grouping })}
        projects={projects.map((p) => ({ project: p, openCount: openByProject.get(p.id) ?? 0 }))}
        projectIds={projectIds}
        onToggleProject={toggleProject}
        onAllProjects={() => updateSettings({ hiddenProjectIds: [] })}
        isProjectsOpen={isProjectsOpen}
        onToggleProjects={() => setProjectsOpen((o) => !o)}
        onCloseProjects={() => setProjectsOpen(false)}
        showClosed={showClosed}
        closedCount={closedTotal}
        onShowClosed={setShowClosed}
        search={search}
        onSearch={setSearch}
      />}
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
        <Drawer isOpen={isPanelOpen} label={t("sessions.detail.label")} resize={isFullscreen ? undefined : panelResize}>
          {selected && (
            <SessionDetail
              session={selected}
              projectName={projectName(selected.projectId)}
              now={now}
              isPluginOutdated={outdatedIds.has(selected.id)}
              foldedSections={settings.foldedSections[isFullscreen ? "fullscreen" : "panel"]}
              actions={actions}
              isFullscreen={isFullscreen}
              onClose={closeDetail}
              onToggleFullscreen={toggleFullscreen}
              onToggleSection={(section) => updateSettings({ foldedSections: toggleSection(settings.foldedSections, isFullscreen ? "fullscreen" : "panel", section) })}
            />
          )}
        </Drawer>
      </div>
      <ConfirmDialog
        isOpen={archiveAsked !== null}
        title={t("sessions.archiveConfirm.title")}
        message={
          !archiveAsked
            ? ""
            : isFinished(archiveAsked)
              ? t("sessions.archiveConfirm.messageNote")
              : t("sessions.archiveConfirm.message", { state: stateLabel(archiveAsked) })
        }
        confirmLabel={t("sessions.archiveConfirm.confirm")}
        cancelLabel={t("sessions.archiveConfirm.cancel")}
        isPending={archive.isPending}
        error={archive.isError ? archive.error.message || t("sessions.toast.failedUnknown") : null}
        onConfirm={() => archiveAsked && archiveNow(archiveAsked.id)}
        onCancel={() => {
          archive.reset();
          setArchiveAsked(null);
        }}
      >
        {archiveAsked?.note && <NoteText note={archiveAsked.note} />}
      </ConfirmDialog>
      {noteFor && (
        <NoteDialog
          key={noteFor.id}
          note={noteFor.note}
          isPending={saveNote.isPending}
          error={saveNote.isError ? saveNote.error.message || t("sessions.toast.failedUnknown") : null}
          onSave={(text) => saveNote.mutate({ id: noteFor.id, text }, { onSuccess: () => setNoteFor(null) })}
          onClose={() => setNoteFor(null)}
        />
      )}
      {newSession && (
        <NewSessionDialog
          projects={projectsQuery.data?.projects ?? null}
          error={projectsQuery.isError ? projectsQuery.error.message || t("sessions.toast.failedUnknown") : null}
          folder={newSession.folder}
          onCopy={copyText}
          onOpen={(command, project, folder) => void openNewSession(command, project, folder)}
          onClose={() => setNewSession(null)}
        />
      )}
      {toast && (
        <Toast
          key={toast.id}
          title={toast.title}
          tone={toast.tone}
          icon={toast.isOpened ? <OpenIcon /> : undefined}
          duration={toast.blockedCommand ? 14_000 : toast.hint ? 6_000 : 3_500}
          closeLabel={t("app.toast.close")}
          onClose={() => setToast(null)}
        >
          {toast.blockedCommand && <BlockedCommand command={toast.blockedCommand} />}
          {toast.hint && <span className={styles.hint}>{toast.hint}</span>}
          {toast.reopenLink && (
            <span>
              <Button size="sm" onClick={() => toast.reopenLink && openLink(toast.reopenLink)}>
                {t("sessions.toast.reopen")}
              </Button>
            </span>
          )}
        </Toast>
      )}
    </div>
  );
}

