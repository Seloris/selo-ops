export const settingsKeys = {
  all: ["settings"] as const,
  // One entry per opening of the window: each opening reads the file again, never an earlier read.
  read: (opening: number) => [...settingsKeys.all, opening] as const,
  // Apart from the window's reads, which a save removes: the sessions page keeps this one.
  cliLaunch: ["cli-launch"] as const,
};
