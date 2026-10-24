import { useCallback, useEffect, useState } from "react";
import { readStored, writeStored } from "./storage.ts";

// app FR-05: the states that notify, none by default, remembered; the browser's permission comes first.
export type NotifyPermission = "unsupported" | NotificationPermission;

const KEY = "selo-ops/notify-states";

function readChosen(): string[] {
  const stored = readStored(KEY);
  return Array.isArray(stored) ? stored.filter((s): s is string => typeof s === "string") : [];
}

// Storage may be blocked: the choice then lasts until the page reloads.
let chosen = readChosen();

export const permissionNow = (): NotifyPermission => ("Notification" in window ? Notification.permission : "unsupported");

export interface NotifySetting {
  permission: NotifyPermission;
  // The states that notify; empty while the browser has not granted the permission.
  states: string[];
  toggle(state: string): void;
}

export function useNotifySetting(): NotifySetting {
  const [permission, setPermission] = useState(permissionNow);
  const [states, setStates] = useState(chosen);

  // A permission changed in the browser's settings shows when the person comes back to the app.
  useEffect(() => {
    const sync = () => setPermission(permissionNow());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  // A choice made in another tab or in the installed app reaches this one.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== KEY) return;
      chosen = readChosen();
      setStates(chosen);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const toggle = useCallback(async (state: string) => {
    if (permissionNow() === "default") await Notification.requestPermission();
    setPermission(permissionNow());
    if (permissionNow() !== "granted") return;
    chosen = chosen.includes(state) ? chosen.filter((s) => s !== state) : [...chosen, state];
    writeStored(KEY, chosen);
    setStates(chosen);
  }, []);

  return { permission, states: permission === "granted" ? states : [], toggle: (state) => void toggle(state) };
}
