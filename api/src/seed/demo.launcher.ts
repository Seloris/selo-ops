import type { SessionLauncher } from "../features/launches/launches.launcher.js";

// The demo never starts Claude Code: its launcher answers a success after a short delay.
const DEMO_LAUNCH_DELAY_MS = 800;

export function createDemoLauncher(delayMs = DEMO_LAUNCH_DELAY_MS): SessionLauncher {
  return {
    launch: () => new Promise((resolve) => setTimeout(() => resolve({ id: "demo1234" }), delayMs)),
  };
}
