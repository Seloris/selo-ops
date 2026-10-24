import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { readStored, writeStored } from "./storage.ts";
import { permissionNow, type NotifyPermission } from "./notifications.ts";

// sessions-live FR-42: the sessions flagged as important, and those of them that notify, remembered in the browser.
export interface Flags {
  flagged: string[];
  // Always a subset of `flagged`.
  notify: string[];
}

const KEY = "selo-ops/session-flags";
const EMPTY: Flags = { flagged: [], notify: [] };

const ids = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

export function parseFlags(stored: unknown): Flags {
  if (typeof stored !== "object" || stored === null) return EMPTY;
  const { flagged, notify } = stored as Record<string, unknown>;
  const flaggedIds = ids(flagged);
  return { flagged: flaggedIds, notify: ids(notify).filter((id) => flaggedIds.includes(id)) };
}

// Unflagging also stops the session's notifications.
export function toggleFlag(flags: Flags, id: string): Flags {
  if (!flags.flagged.includes(id)) return { ...flags, flagged: [...flags.flagged, id] };
  return { flagged: flags.flagged.filter((f) => f !== id), notify: flags.notify.filter((n) => n !== id) };
}

// Only a flagged session notifies.
export function toggleNotify(flags: Flags, id: string): Flags {
  if (flags.notify.includes(id)) return { ...flags, notify: flags.notify.filter((n) => n !== id) };
  return flags.flagged.includes(id) ? { ...flags, notify: [...flags.notify, id] } : flags;
}

// shortcut: ids of sessions gone from the export stay stored, a few bytes each; prune against the sessions if it ever grows.
let current = parseFlags(readStored(KEY));
const listeners = new Set<() => void>();

function set(next: Flags) {
  current = next;
  writeStored(KEY, next);
  listeners.forEach((l) => l());
}

// One store for the page and the shell's notifier in this tab; the storage event brings the other tabs' changes.
function subscribe(listener: () => void) {
  listeners.add(listener);
  const sync = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    current = parseFlags(readStored(KEY));
    listener();
  };
  window.addEventListener("storage", sync);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", sync);
  };
}

export interface SessionFlags {
  isFlagged(id: string): boolean;
  isNotified(id: string): boolean;
  permission: NotifyPermission;
  toggleFlag(id: string): void;
  toggleNotify(id: string): void;
  // The sessions that notify; empty while the browser has not granted the permission.
  notifyIds: string[];
}

export function useSessionFlags(): SessionFlags {
  const flags = useSyncExternalStore(subscribe, () => current);
  // Read at each render, so that a grant made through another instance (the page's switch, the bell) reaches this one
  // at its next render; the state only re-renders this instance after its own request or on focus.
  const [, setPermission] = useState(permissionNow);
  const permission = permissionNow();

  // A permission changed in the browser's settings shows when the person comes back to the app.
  useEffect(() => {
    const sync = () => setPermission(permissionNow());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  const onToggleNotify = useCallback(async (id: string) => {
    // Turning on asks the browser's permission first, as the bell does (app FR-05); turning off never does.
    if (!current.notify.includes(id)) {
      if (permissionNow() === "default") await Notification.requestPermission();
      setPermission(permissionNow());
      if (permissionNow() !== "granted") return;
    }
    set(toggleNotify(current, id));
  }, []);
  return {
    isFlagged: (id) => flags.flagged.includes(id),
    isNotified: (id) => permission === "granted" && flags.notify.includes(id),
    permission,
    toggleFlag: (id) => set(toggleFlag(current, id)),
    toggleNotify: (id) => void onToggleNotify(id),
    notifyIds: permission === "granted" ? flags.notify : [],
  };
}
