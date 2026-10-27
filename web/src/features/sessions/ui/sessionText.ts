import { dayTime } from "../../../shared/lib/dayTime.ts";
import { formatAge } from "../../../shared/lib/formatAge.ts";
import { t, tn, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import type { DotTone } from "../../../shared/ui/StatusDot.tsx";
import { ageMs, bucketOf, isOpen, isTodo, worktreeOf, type InstalledPlugin, type Project, type Session } from "../data/sessionView.ts";
import { formatTokens, totalTokens } from "./usage.ts";

// The words and tones a session shows, shared by its row, its card and its detail.

const units = () => ({ s: t("app.age.s"), min: t("app.age.min"), h: t("app.age.h"), d: t("app.age.d") });

export const age = (ms: number) => formatAge(ms, units());

// sessions-live FR-19: the day and time the session was created, with its year only when it is not the current one.
export function createdText(iso: string, now: number): string {
  const { day, time } = dayTime(iso, now);
  return t("sessions.detail.created", { day, time });
}

export const stateLabel = (s: Session) => t(`sessions.state.${s.state}` as MessageKey);

// `session` BR-22: an autonomous pilot reads « pilot autonome ».
function flowLabel(s: Pick<Session, "flow" | "mode">): string {
  if (s.flow === "free") return t("sessions.lane.free");
  return s.flow === "pilot" && s.mode === "autonomous" ? t("sessions.lane.pilotAutonomous") : s.flow;
}

// `session` BR-22: a fastlane in its iterate mode runs its loop until its end's first mark past `code` (`tests` first).
export const LOOP_SUBSTEPS: ReadonlySet<string | null> = new Set([null, "code"]);

export const isIterating = (s: Pick<Session, "mode" | "substep" | "trail">): boolean =>
  s.mode === "iterate" && LOOP_SUBSTEPS.has(s.substep) && s.trail.every((e) => LOOP_SUBSTEPS.has(e.substep));

type WorkOf = Pick<Session, "isOutsideSelo" | "flow" | "skill" | "mode" | "substep" | "trail">;

// `session` BR-22: the run's flow, then the skill running when it is another, or « itération » in a fastlane's loop;
// a session outside selo (`session` BR-12) reads « hors selo ».
export function workLabel(s: WorkOf): string {
  if (s.isOutsideSelo) return t("sessions.lane.outside");
  const flow = flowLabel(s);
  if (isIterating(s)) return `${flow} › ${t("sessions.lane.iterate")}`;
  return s.skill && s.skill !== s.flow ? `${flow} › ${s.skill}` : flow;
}

// sessions-live FR-11: the row's second line under the badge — the type of work, then the project when shown.
export const metaText = (s: WorkOf, project: string | null): string =>
  project === null ? workLabel(s) : `${workLabel(s)} · ${project}`;

// The fir tree's room on the second line (FR-52), in the line's monospace ch.
const TREE_CH = 4;

// sessions-live FR-11: the second line's width in ch, the fir tree of a worktree's session included (FR-52).
export const metaWidth = (s: WorkOf & Pick<Session, "folder">, project: string | null): number =>
  metaText(s, project).length + (worktreeOf(s.folder) === null ? 0 : TREE_CH);

const LANES: ReadonlySet<string> = new Set(["free", "fastlane", "blueprint", "pilot"]);

// sessions-live FR-29: the type of work in its lane's colour, the help's, a mockup or a fastlane's loop in its flow's;
// neutral outside selo or for an unknown flow.
export function laneColor(s: WorkOf): string | undefined {
  if (s.isOutsideSelo) return undefined;
  if (isIterating(s)) return "var(--lane-iterate)";
  if (s.skill === "mockup") return "var(--lane-mockup)";
  return LANES.has(s.flow) ? `var(--lane-${s.flow})` : undefined;
}

export interface NextCommand {
  summary: string | null;
  command: string;
}

// sessions-live FR-48: the resume prompt, then each next step of the done footer; a command once, with the summary a
// next step gives it; a next step on the resume prompt's blueprint takes its place; nothing for an archived session (FR-21).
export function nextCommands(s: Pick<Session, "isArchived" | "nextAction" | "nextSteps">): NextCommand[] {
  if (s.isArchived || !s.nextAction) return [];
  const resume: NextCommand = { summary: null, command: s.nextAction };
  const shown = [resume];
  const byCommand = new Map<string, NextCommand>([[s.nextAction, resume]]);
  const resumeBlueprint = blueprintOf(s.nextAction);
  let isResumeReplaced = false;
  for (const { summary, command } of s.nextSteps) {
    const known = byCommand.get(command);
    if (known) known.summary ??= summary;
    else if (!isResumeReplaced && resumeBlueprint && blueprintOf(command) === resumeBlueprint) {
      Object.assign(resume, { summary, command });
      byCommand.set(command, resume);
      isResumeReplaced = true;
    } else {
      const step = { summary, command };
      shown.push(step);
      byCommand.set(command, step);
    }
  }
  return shown;
}

// The blueprint a selo command runs on (`/selo-flow:build .planning/blueprints/x.md` → its path), else null.
function blueprintOf(command: string): string | null {
  const match = /^\/\S+\s+(\.planning\/blueprints\/\S+\.md)(?:\s|$)/.exec(command.trim());
  return match?.[1] ?? null;
}

// sessions-live FR-21: the one « Action suivante » of a session, the first of its next steps, in the list, the card and the detail.
export const nextCommand = (s: Pick<Session, "isArchived" | "nextAction" | "nextSteps">): string | null => nextCommands(s)[0]?.command ?? null;

export const blockerLabel = (b: Session["blockers"][number]) => t(`sessions.blocker.${b}` as MessageKey);

// sessions-live FR-28: what clears a blocker; amber only for those that wait on the person.
export const blockerHint = (b: Session["blockers"][number]) => t(`sessions.blocker.hint.${b}` as MessageKey);

// sessions-live FR-28: a pending commit already says the work is not done and its files are not committed.
const IMPLIED_BY_COMMIT: ReadonlySet<Session["blockers"][number]> = new Set(["not-done", "dirty-files"]);

export function shownBlockers(s: Session): Session["blockers"] {
  return s.blockers.includes("pending-commit") ? s.blockers.filter((b) => !IMPLIED_BY_COMMIT.has(b)) : s.blockers;
}

export function blockerTone(b: Session["blockers"][number]): DotTone {
  if (b === "question" || b === "pending-commit") return "warn";
  if (b === "background-tasks" || b === "subagents") return "pulse";
  return "idle";
}

// sessions-live FR-10: one colour per meaning; a closed or archived session waits on nobody, whatever its state.
export function toneOf(s: Session): DotTone {
  if (!isOpen(s)) return "off";
  if (isTodo(s)) return s.state === "stopped" ? "danger" : "warn";
  if (s.state === "working") return "pulse";
  if (s.state === "turn-ended") return "turn";
  return s.state === "job-done" ? "done" : "idle";
}

export type AwaitedKind = "question" | "permission" | "commit" | "error";

export interface Awaited {
  kind: AwaitedKind;
  // The label of the card and the detail.
  label: string;
  text: string;
  // The whole text: a commit with its body.
  full: string;
  isCode: boolean;
}

// sessions-live FR-15: only the states that wait on the person have something awaited.
export function awaitedOf(s: Session): Awaited | null {
  if (bucketOf(s.state) !== "todo") return null;
  if (s.state === "awaiting-answer") {
    // A session outside selo, or a question the export missed, gives no text: Claude Code only says it awaits an answer.
    const text = s.question ?? t("sessions.awaited.outsideQuestion");
    return { kind: "question", label: t("sessions.awaited.question"), text, full: text, isCode: false };
  }
  if (s.state === "awaiting-permission") {
    // The transcript names no tool when it is a subagent's, or when its call left the tail.
    const tool = s.permissionTool;
    const text = tool === null ? t("sessions.awaited.permissionUnknown") : t("sessions.awaited.permissionTool", { tool });
    return { kind: "permission", label: t("sessions.awaited.permission"), text, full: text, isCode: tool !== null };
  }
  if (s.state === "awaiting-commit") {
    const subject = s.pendingCommit?.subject ?? "";
    const body = s.pendingCommit?.body ?? "";
    return { kind: "commit", label: t("sessions.awaited.commit"), text: subject, full: body ? `${subject}\n\n${body}` : subject, isCode: true };
  }
  const text = s.error ?? t("sessions.awaited.interrupted");
  return { kind: "error", label: t("sessions.awaited.error"), text, full: text, isCode: s.error !== null };
}

// The stage alone (« Étape 2 »), null without one.
export function stageText(s: Pick<Session, "step">): string | null {
  const stage = /^stage:(\d+)$/.exec(s.step ?? "")?.[1];
  return stage ? t("sessions.step.stage", { number: stage }) : null;
}

export function stepText(s: Pick<Session, "step" | "substep">): string | null {
  const step = stageText(s);
  if (step && s.substep) return `${step} · ${s.substep}`;
  return step ?? s.substep;
}

export type RowContext = { kind: "awaited"; awaited: Awaited } | { kind: "step"; text: string } | { kind: "next"; command: string } | { kind: "none" };

// sessions-live FR-11: the second line of a row says what is awaited, else the step at work, else the next action.
export function rowContext(s: Session): RowContext {
  const awaited = isTodo(s) ? awaitedOf(s) : null;
  if (awaited) return { kind: "awaited", awaited };
  const step = s.state === "working" && isOpen(s) ? stepText(s) : null;
  if (step) return { kind: "step", text: step };
  const next = nextCommand(s);
  if (next) return { kind: "next", command: next };
  return { kind: "none" };
}

// What a session does when nothing is awaited from the person.
export function calmText(s: Session): string {
  if (s.state === "working") {
    const step = stepText(s);
    return step ? t("sessions.calm.workingStep", { step }) : t("sessions.calm.working");
  }
  if (s.state === "turn-ended") return t("sessions.calm.turnEnded");
  if (s.state === "job-done") return t("sessions.calm.jobDone");
  return t("sessions.calm.none");
}

export interface AgeDisplay {
  text: string;
  // A tag replaces the plain age (closed, archived).
  isTag: boolean;
}

// sessions-live FR-14.
export function ageDisplay(s: Session, now: number): AgeDisplay {
  const text = age(ageMs(s, now));
  if (s.isArchived) return { text: t("sessions.age.archived", { age: text }), isTag: true };
  if (s.isClosed) return { text: t("sessions.age.closed", { age: text }), isTag: true };
  if (s.state === "job-done" || s.state === "turn-ended") return { text: t("sessions.age.finished", { age: text }), isTag: false };
  return { text, isTag: false };
}

// `session` BR-10: « … » when the export cut the request; an image with no text says so.
export function requestText(s: Session): string {
  if (!s.request) return t(s.isRequestImage ? "sessions.request.image" : "sessions.request.empty");
  return s.isRequestCut ? `${s.request}…` : s.request;
}

export const resumeCommand = (s: Session) => `claude --resume ${s.id}`;

// The page navigates to no other address from the api than this exact shape, the desktop app's link of a session
// (sessions-live FR-20): anything else (a `javascript:` URL, another host, an extra path) is dropped.
const DESKTOP_LINK = /^claude:\/\/claude\.ai\/epitaxy\/local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const desktopLinkOf = (s: Session): string | null => (s.desktopLink && DESKTOP_LINK.test(s.desktopLink) ? s.desktopLink : null);

// sessions-live FR-19: the version of the plugin that wrote the session's export file.
export const writtenByText = (s: Session) =>
  s.writtenBy ? t("sessions.detail.writtenByValue", { version: s.writtenBy }) : t("sessions.facts.unknown");

// sessions-live FR-02: the selo plugins Claude Code lists as installed, every version of one installed at several.
export function pluginsText(plugins: InstalledPlugin[]): string | null {
  if (!plugins.length) return null;
  return plugins.map((p) => `${p.name} ${p.versions.join(" / ")}`).join(" · ");
}

// sessions-live FR-39: the session was written by a selo-feed version other than the installed ones (the header's).
// Nothing to compare when the export gives no version or Claude Code lists no selo-feed.
export function isPluginOutdated(s: Session, plugins: InstalledPlugin[]): boolean {
  const installed = plugins.find((p) => p.name === "selo-feed");
  return Boolean(s.writtenBy && installed && !installed.versions.includes(s.writtenBy));
}

export const outdatedIdsOf = (sessions: Session[], plugins: InstalledPlugin[]): Set<string> =>
  new Set(sessions.filter((s) => isPluginOutdated(s, plugins)).map((s) => s.id));

// sessions-live FR-13: the model with the session's total tokens (`session` BR-18, « — » with no usage), then the effort.
export function modelText(s: Session): string {
  const tokens = s.usage ? formatTokens(totalTokens(s.usage.tokens)) : t("sessions.facts.unknown");
  const model = t("sessions.facts.modelTokens", { model: s.model ?? t("sessions.facts.unknown"), tokens });
  // sessions-live FR-30: only the export gives the effort.
  const effort = s.effort ?? (s.isOutsideSelo ? t("sessions.facts.unknown") : null);
  return effort ? t("sessions.facts.modelEffort", { model, effort }) : model;
}

// sessions-live FR-19: whether a session outside selo can be closed is unknown, its empty blockers say nothing.
export function closeText(s: Session): string {
  if (s.isOutsideSelo) return t("sessions.close.outside");
  const blockers = shownBlockers(s);
  return blockers.length ? t("sessions.close.short", { reasons: blockers.map(blockerLabel).join(" · ") }) : t("sessions.close.yes");
}

// sessions-live FR-12: a project only sessions outside selo show has no count of uncommitted files.
export function changedText(project: Project): string | null {
  if (project.changedCount === null) return null;
  return project.changedCount ? tn("sessions.group.changed", project.changedCount) : t("sessions.group.clean");
}
