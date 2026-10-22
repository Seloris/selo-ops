import { formatAge } from "../../../shared/lib/formatAge.ts";
import { t, tn, type MessageKey } from "../../../shared/lib/i18n/index.ts";
import type { DotTone } from "../../../shared/ui/StatusDot.tsx";
import { ageMs, bucketOf, isStale, isTodo, type Project, type Session } from "../data/sessionView.ts";

// The words and tones a session shows, shared by its row, its card and its detail.

const units = () => ({ s: t("app.age.s"), min: t("app.age.min"), h: t("app.age.h"), d: t("app.age.d") });

export const age = (ms: number) => formatAge(ms, units());

// sessions-live FR-19: the day and time the session was created, with its year only when it is not the current one.
export function createdText(iso: string, now: number): string {
  const at = new Date(iso);
  const isThisYear = at.getFullYear() === new Date(now).getFullYear();
  const day = at.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(isThisYear ? {} : { year: "numeric" }) });
  const time = at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return t("sessions.detail.created", { day, time });
}

export const stateLabel = (s: Session) => t(`sessions.state.${s.state}` as MessageKey);

export const laneLabel = (lane: string) => (lane === "free" ? t("sessions.lane.free") : lane);

// sessions-live FR-11: a session outside selo (`session` BR-12) reads « hors selo », whatever its lane.
export const sessionLaneLabel = (s: Session) => (s.isOutsideSelo ? t("sessions.lane.outside") : laneLabel(s.lane));

// sessions-live FR-29: libre, fastlane and autopilot each have their colour; the other lanes stay neutral.
export type LaneTone = "free" | "fastlane" | "autopilot";

export function laneTone(lane: string): LaneTone | null {
  return lane === "free" || lane === "fastlane" || lane === "autopilot" ? lane : null;
}

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

// sessions-live FR-10: colour only on sessions to handle.
export function toneOf(s: Session): DotTone {
  if (isTodo(s)) return s.state === "stopped" ? "danger" : "warn";
  if (s.state === "working" && !s.isClosed && !s.isArchived) return "pulse";
  return s.state === "job-done" ? "hollow" : "idle";
}

export type AwaitedKind = "question" | "commit" | "error";

export interface Awaited {
  kind: AwaitedKind;
  // A short key for the list row, a label for the card and the detail.
  key: string;
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
    // A session outside selo never gives its question's text: Claude Code only says it awaits an answer.
    const text = s.question ?? (s.isOutsideSelo ? t("sessions.awaited.outsideQuestion") : "");
    return { kind: "question", key: t("sessions.awaited.questionKey"), label: t("sessions.awaited.question"), text, full: text, isCode: false };
  }
  if (s.state === "awaiting-commit") {
    const subject = s.pendingCommit?.subject ?? "";
    const body = s.pendingCommit?.body ?? "";
    return { kind: "commit", key: t("sessions.awaited.commitKey"), label: t("sessions.awaited.commit"), text: subject, full: body ? `${subject}\n\n${body}` : subject, isCode: true };
  }
  const text = s.error ?? t("sessions.awaited.interrupted");
  return { kind: "error", key: t("sessions.awaited.errorKey"), label: t("sessions.awaited.error"), text, full: text, isCode: s.error !== null };
}

export function stepText(s: Session): string | null {
  const stage = /^stage:(\d+)$/.exec(s.step ?? "")?.[1];
  const step = stage ? t("sessions.step.stage", { number: stage }) : null;
  if (step && s.substep) return `${step} · ${s.substep}`;
  return step ?? s.substep;
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
  // A tag replaces the plain age; `isStale` adds the clock icon.
  isTag: boolean;
  isStale: boolean;
}

// sessions-live FR-14.
export function ageDisplay(s: Session, now: number): AgeDisplay {
  const text = age(ageMs(s, now));
  if (s.isArchived) return { text: t("sessions.age.archived", { age: text }), isTag: true, isStale: false };
  if (s.isClosed) return { text: t("sessions.age.closed", { age: text }), isTag: true, isStale: false };
  if (isStale(s, now)) return { text: t("sessions.age.stale", { age: text }), isTag: true, isStale: true };
  return { text, isTag: false, isStale: false };
}

// `session` BR-10: « … » when the export cut the request.
export function requestText(s: Session): string {
  if (!s.request) return t("sessions.request.empty");
  return s.isRequestCut ? `${s.request}…` : s.request;
}

export const resumeCommand = (s: Session) => `claude --resume ${s.id}`;

// The page navigates to no other address from the api than this exact shape, the desktop app's link of a session
// (sessions-live FR-20): anything else (a `javascript:` URL, another host, an extra path) is dropped.
const DESKTOP_LINK = /^claude:\/\/claude\.ai\/epitaxy\/local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const desktopLinkOf = (s: Session): string | null => (s.desktopLink && DESKTOP_LINK.test(s.desktopLink) ? s.desktopLink : null);

export function modelText(s: Session): string {
  const model = s.model ?? t("sessions.facts.unknown");
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
