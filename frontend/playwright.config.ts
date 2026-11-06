import { defineConfig, devices } from "@playwright/test";

/**
 * Browser E2E configuration.
 *
 * These tests expect the real stack to be running (SQLite or Docker), exactly as the integration
 * suite does: `./scripts/dev.sh` or `docker compose up -d --build`. CI starts the SQLite stack in
 * the `sqlite` job and runs this suite before tearing it down. `E2E_BASE_URL` and `E2E_API_URL`
 * override the defaults when the services live elsewhere.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // One worker: every test writes to the same SQLite file in CI, where concurrent signups can
  // contend for the write lock. There are only four short flows.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // `junit` feeds the CI artifact and step summary; `html` is the local debugging report.
  reporter: [
    ["list"],
    ["junit", { outputFile: "e2e-results.xml" }],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    actionTimeout: 10_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
