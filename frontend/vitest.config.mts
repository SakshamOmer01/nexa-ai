import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    // next/navigation, fetch and env vars are mocked per test; leave no stub behind.
    unstubGlobals: true,
    unstubEnvs: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      // `text` for the log, `json-summary` for the run summary, `lcov` for the uploaded artifact.
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      // Measure every source file, not only the ones a test happened to import, so an untested
      // module lowers the score instead of being invisible to it.
      include: ["src/**/*.{ts,tsx}"],
      // Test files are the measurement tool, and `src/types` is declarations only (no runtime code).
      exclude: ["src/**/*.test.{ts,tsx}", "src/types/**"],
      // Every source file is measured, so these are a real gate on new code, not a summary of the
      // files a test happened to touch. The suite is at 100/98.8/100/100, which leaves roughly 12
      // statements and 8 branches of slack: room for a small untested module, not for a feature.
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
