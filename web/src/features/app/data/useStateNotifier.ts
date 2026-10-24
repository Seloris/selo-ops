import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { t } from "../../../shared/lib/i18n/index.ts";
import type { SessionState } from "../../sessions/data/sessionView.ts";
import { newlyWatched, watchedStates } from "../../sessions/data/stateAlerts.ts";
import { useSessionsQuery } from "../../sessions/data/useSessionsQuery.ts";
import { requestText, stateLabel } from "../../sessions/ui/sessionText.ts";

// app FR-05: a browser notification for each open session that enters a chosen state, on every page, tab hidden or not.
export function useStateNotifier(states: string[]) {
  const navigate = useNavigate();
  const isOn = states.length > 0;
  const statesKey = [...states].sort().join(",");
  const watched = useMemo(() => new Set(statesKey.split(",") as SessionState[]), [statesKey]);
  const { data } = useSessionsQuery({ enabled: isOn, inBackground: true });
  const before = useRef<{ key: string; states: Map<string, SessionState> } | null>(null);

  useEffect(() => {
    if (!isOn || data === undefined) return;
    // A new choice starts from a fresh baseline: the sessions already in a chosen state raise nothing.
    const raised = before.current?.key === statesKey ? newlyWatched(before.current.states, data.sessions, watched) : [];
    before.current = { key: statesKey, states: watchedStates(data.sessions, watched) };
    if (document.hasFocus()) return;
    const projects = new Map(data.projects.map((p) => [p.id, p.name]));
    for (const s of raised) {
      let notification: Notification;
      try {
        // `tag`: one notification per session, the newer replacing the older; `renotify`: and still shown again.
        notification = new Notification(t("app.notify.title", { state: stateLabel(s), project: projects.get(s.projectId) ?? s.projectId }), {
          body: requestText(s),
          tag: s.id,
          renotify: true,
          icon: "/icon-192.png",
        } as NotificationOptions);
      } catch {
        // Chrome on Android only notifies through a service worker: no notification there, never a broken page.
        return;
      }
      notification.onclick = () => {
        window.focus();
        void navigate(`/?session=${encodeURIComponent(s.id)}`);
        notification.close();
      };
    }
  }, [isOn, data, statesKey, watched, navigate]);

  // Turned off, the next turn on starts from a fresh baseline too.
  useEffect(() => {
    if (!isOn) before.current = null;
  }, [isOn]);
}
