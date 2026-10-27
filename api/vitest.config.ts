import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Every file opens its own in-memory PGlite at once: on a busy machine the first open, and the demo's seed (which
    // runs git), outlast the defaults.
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
