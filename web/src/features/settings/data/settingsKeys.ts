export const settingsKeys = {
  all: ["settings"] as const,
  // One entry per opening of the window: each opening reads the file again, never an earlier read.
  read: (opening: number) => [...settingsKeys.all, opening] as const,
};
