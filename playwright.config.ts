import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright smoke E2E config.
 * - Spins up apps/web via webServer (Next dev on :3000).
 * - apps/api expected to be reachable at API_BASE_URL (default :3001).
 *   If not running, the dashboard falls back to its mock dataset, which
 *   is sufficient for smoke assertions on rendered text.
 */
export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.WEB_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm --filter web dev",
    url: process.env.WEB_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
