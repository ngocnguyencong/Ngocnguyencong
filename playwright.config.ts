import { defineConfig, devices } from "@playwright/test";

const localWebPort = process.env.PLAYWRIGHT_PORT ?? "3100";
const localBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${localWebPort}`;
const isWindows = process.platform === "win32";
const localWebCommand = isWindows
  ? `apps\\web\\node_modules\\.bin\\next.cmd dev apps\\web --port ${localWebPort}`
  : `apps/web/node_modules/.bin/next dev apps/web --port ${localWebPort}`;

export default defineConfig({
  expect: { timeout: isWindows ? 30_000 : 15_000 },
  timeout: 60_000,
  fullyParallel: true,
  workers: isWindows ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  globalSetup: "./tests/e2e/global-setup.ts",
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: localBaseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL,
      },
    },
  ],
  webServer: {
    command: localWebCommand,
    env: {
      APP_ENV: "local",
      AI_PROVIDER: "fake",
      BILLING_PROVIDER: "local",
      EMAIL_PROVIDER: "local",
      JOB_PROVIDER: "local",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: localBaseURL,
  },
});
