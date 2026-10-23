import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router";
import { copyText } from "../../../shared/lib/clipboard.ts";
import { t, tn } from "../../../shared/lib/i18n/index.ts";
import { readStored, writeStored } from "../../../shared/lib/storage.ts";
import { useNow } from "../../../shared/lib/useNow.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { Drawer, type DrawerResize } from "../../../shared/ui/Drawer.tsx";
import { EmptyState } from "../../../shared/ui/EmptyState.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { RefreshIcon } from "../../../shared/ui/icons.tsx";
import { LoadingState } from "../../../shared/ui/LoadingState.tsx";
import { PageTitle } from "../../../shared/ui/PageTitle.tsx";
import { Toast } from "../../../shared/ui/Toast.tsx";
import { useSessionsQuery } from "../../sessions/data/useSessionsQuery.ts";
import { isOpen } from "../../sessions/data/sessionView.ts";
import { age, requestText, toneOf } from "../../sessions/ui/sessionText.ts";
import { MIN_PANEL_WIDTH, PANEL_WIDTH_STEP, clampPanelWidth, parsePanelWidth } from "../../sessions/ui/panelWidth.ts";
import { blueprintsTouching, pageCounts, sortProjects, type ProjectOverview } from "../data/projectView.ts";
import { useProjectFileQuery } from "../data/useProjectFileQuery.ts";
import { useProjectsQuery } from "../data/useProjectsQuery.ts";
import { ProjectCards } from "../ui/ProjectCards.tsx";
import { ProjectPanel, type PanelSubject } from "../ui/ProjectPanel.tsx";
import type { LiveItem } from "../ui/ProjectParts.tsx";
import { DEBT_FILE, IDEAS_FILE, ProjectView } from "../ui/ProjectView.tsx";
import styles from "./ProjectsPage.module.css";

const PANEL_WIDTH_KEY = "selo-ops/projects/panel-width";

interface ToastState {
  id: number;
  title: string;
  hint?: string;
  tone?: "done" | "warn";
}

// What the panel shows for a path of the project: one of its blueprints or sheets, its ideas or its debt.
function subjectOf(project: ProjectOverview, path: string): PanelSubject | null {
  const blueprint = project.blueprints.find((b) => b.file === path);
  if (blueprint) return { kind: "blueprint", blueprint };
  const sheet = project.sheets.find((s) => s.file === path);
  if (sheet) return { kind: "sheet", sheet, touching: blueprintsTouching(project.blueprints, sheet) };
  if (path === IDEAS_FILE) return { kind: "ideas", title: t("projects.specs.ideas") };
  if (path === DEBT_FILE) return { kind: "debt", title: t("projects.specs.debt") };
  return null;
}

// projects FR-01 to FR-16: the cards of the projects, or one project's view; its files in the side panel.
export function ProjectsPage() {
  const query = useProjectsQuery();
  const sessionsQuery = useSessionsQuery();
  const now = useNow(1000);
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project");
  const path = params.get("file");

  const [panelWidth, setPanelWidth] = useState(() => parsePanelWidth(readStored(PANEL_WIDTH_KEY)));
  const [isResizing, setResizing] = useState(false);
  const [isFullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const appRef = useRef<HTMLDivElement>(null);

  const projects = useMemo(() => sortProjects(query.data?.projects ?? []), [query.data]);
  // projects FR-03: a project with no selo planning does not open, even from its address.
  const project = projectId === null ? null : (projects.find((p) => p.id === projectId && p.hasPlanning) ?? null);
  const subject = project && path ? subjectOf(project, path) : null;
  const isPanelOpen = subject !== null;
  const file = useProjectFileQuery(isPanelOpen ? (project?.id ?? null) : null, isPanelOpen ? path : null);

  const sessionsById = useMemo(() => new Map((sessionsQuery.data?.sessions ?? []).map((s) => [s.id, s])), [sessionsQuery.data]);
  const liveOf = useCallback(
    (ids: string[]): LiveItem[] =>
      ids.flatMap((id) => {
        const s = sessionsById.get(id);
        // A closed session is no longer live: left out.
        return s && isOpen(s) ? [{ id, tone: toneOf(s), text: requestText(s) }] : [];
      }),
    [sessionsById],
  );
  const ageOf = (iso: string) => age(now - Date.parse(iso));

  const setAddress = useCallback(
    (patch: Record<string, string | null>) =>
      setParams((p) => {
        const next = new URLSearchParams(p);
        for (const [key, value] of Object.entries(patch)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      }),
    [setParams],
  );

  const closePanel = useCallback(() => {
    setFullscreen(false);
    setAddress({ file: null });
  }, [setAddress, setFullscreen]);

  // The browser's own Échap leaves its full screen: the page follows, and the other way round (sessions-live FR-37).
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
    void appRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  // projects FR-10: Échap leaves the full screen first, then closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isFullscreen) setFullscreen(false);
      else if (path !== null) closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, path, closePanel]);

  // sessions-live FR-27, for this page's panel: its own remembered width.
  const updateWidth = (width: number | null) => {
    setPanelWidth(width);
    writeStored(PANEL_WIDTH_KEY, width);
  };
  const panelResize: DrawerResize = {
    label: t("projects.panel.resize"),
    min: MIN_PANEL_WIDTH,
    max: clampPanelWidth(Number.POSITIVE_INFINITY, window.innerWidth),
    step: PANEL_WIDTH_STEP,
    onResize: (width) => {
      appRef.current?.style.setProperty("--drawer-chosen-w", `${clampPanelWidth(width, window.innerWidth)}px`);
      setResizing(true);
    },
    onResizeEnd: (width) => {
      setResizing(false);
      updateWidth(clampPanelWidth(width, window.innerWidth));
    },
    onReset: () => {
      setResizing(false);
      updateWidth(null);
    },
  };

  const toastId = useRef(0);
  const copy = async (prompt: string) => {
    toastId.current += 1;
    const isCopied = await copyText(prompt);
    setToast(
      isCopied
        ? { id: toastId.current, title: t("projects.toast.copied"), hint: t("projects.toast.copiedHint") }
        : { id: toastId.current, title: t("projects.toast.copyBlocked"), hint: prompt, tone: "warn" },
    );
  };

  const counts = pageCounts(projects);
  const updatedSeconds = query.dataUpdatedAt ? Math.max(0, Math.floor((now - query.dataUpdatedAt) / 1000)) : null;
  const isOnlyPanel = isPanelOpen && isFullscreen;
  const errorText = query.error?.message || t("projects.page.errorUnknown");

  return (
    <div
      ref={appRef}
      className={`${styles.app} ${isPanelOpen ? styles.withPanel : ""} ${isOnlyPanel ? styles.fullscreen : ""} ${panelWidth !== null || isResizing ? styles.sized : ""} ${isResizing ? styles.resizing : ""}`}
      style={panelWidth !== null ? ({ "--drawer-chosen-w": `${panelWidth}px` } as CSSProperties) : undefined}
    >
      {!isOnlyPanel && (
        <div className={styles.top}>
          <div className={styles.brand}>
            <PageTitle>{t("projects.page.title")}</PageTitle>
            {query.data && (
              <p className={styles.sub}>
                {tn("projects.subtitle.projects", counts.projects)} · {tn("projects.subtitle.open", counts.open)} ·{" "}
                <b>{t("projects.subtitle.building", { count: counts.building })}</b>
              </p>
            )}
          </div>
          <span className={styles.grow} />
          {updatedSeconds !== null && (
            <span className={styles.updated}>
              <span className={query.isFetching ? styles.spin : ""}>
                <RefreshIcon />
              </span>
              {t("projects.updated.text", { seconds: updatedSeconds })}
            </span>
          )}
        </div>
      )}
      <div className={styles.body}>
        <main className={styles.content}>
          {query.isPending ? (
            <LoadingState>{t("projects.page.loading")}</LoadingState>
          ) : query.isError && !query.data ? (
            <div className={styles.error}>
              <ErrorMessage>{t("projects.page.error", { message: errorText })}</ErrorMessage>
              <Button size="sm" onClick={() => void query.refetch()}>
                {t("projects.page.retry")}
              </Button>
            </div>
          ) : (
            <>
              {query.isError && <ErrorMessage>{t("projects.page.refreshError", { message: errorText })}</ErrorMessage>}
              {projectId !== null ? (
                project ? (
                  <ProjectView
                    project={project}
                    openPath={isPanelOpen ? path : null}
                    liveOf={liveOf}
                    ageOf={ageOf}
                    onBack={() => setAddress({ project: null, file: null })}
                    onOpenFile={(p) => setAddress({ file: p })}
                    onCopy={(prompt) => void copy(prompt)}
                  />
                ) : (
                  <>
                    <Button size="sm" onClick={() => setAddress({ project: null, file: null })}>
                      ← {t("projects.view.back")}
                    </Button>
                    <EmptyState>{t("projects.empty.notFound")}</EmptyState>
                  </>
                )
              ) : projects.length === 0 ? (
                <EmptyState>{t("projects.empty.none")}</EmptyState>
              ) : (
                <ProjectCards projects={projects} liveOf={(p) => liveOf(p.sessionIds)} onOpen={(id) => setAddress({ project: id, file: null })} />
              )}
            </>
          )}
        </main>
        <Drawer isOpen={isPanelOpen} label={t("projects.panel.label")} resize={isFullscreen ? undefined : panelResize}>
          {subject && (
            <ProjectPanel
              key={path}
              subject={subject}
              file={{ isPending: file.isPending, error: file.isError ? file.error.message : null, text: file.data?.text ?? null }}
              liveOf={liveOf}
              ageOf={ageOf}
              isFullscreen={isFullscreen}
              onClose={closePanel}
              onToggleFullscreen={toggleFullscreen}
              onCopy={(prompt) => void copy(prompt)}
            />
          )}
        </Drawer>
      </div>
      {toast && (
        <Toast key={toast.id} title={toast.title} tone={toast.tone} duration={toast.tone === "warn" ? 14_000 : 3_500} closeLabel={t("projects.toast.close")} onClose={() => setToast(null)}>
          {toast.hint && <span className={styles.hint}>{toast.hint}</span>}
        </Toast>
      )}
    </div>
  );
}
