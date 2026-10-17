import { defineConfig, devices } from "@playwright/test";

const productionWebPort = "3110";
const productionBaseURL = `http://localhost:${productionWebPort}`;
const productionWebCommand =
  process.platform === "win32"
    ? `apps\\web\\node_modules\\.bin\\next.cmd dev apps\\web --port ${productionWebPort}`
    : `apps/web/node_modules/.bin/next dev apps/web --port ${productionWebPort}`;

export default defineConfig({
  // Same dev-mode compile latency the local config tolerates: cold routes
  // render slowly on loaded CI runners, so match its 15s expect / 60s test
  // budgets instead of the 5s/30s defaults.
  expect: { timeout: 15_000 },
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  globalSetup: "./tests/e2e-production/global-setup.ts",
  testDir: "./tests/e2e-production",
  use: {
    baseURL: productionBaseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-production",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL,
      },
    },
  ],
  webServer: {
    command: productionWebCommand,
    env: {
      AI_PROVIDER: "fake",
      AI_MODEL_POLICY: JSON.stringify({
        cheap: ["model-cheap"],
        fast: ["model-fast"],
        smart: ["model-smart"],
      }),
      ANTHROPIC_API_KEY: "",
      APP_ENV: "development",
      APP_URL: productionBaseURL,
      AUTH_APPLE_ENABLED: "false",
      APPLE_CLIENT_ID: "",
      APPLE_CLIENT_SECRET: "",
      AUTH_GITHUB_ENABLED: "false",
      GITHUB_CLIENT_ID: "",
      GITHUB_CLIENT_SECRET: "",
      AUTH_GOOGLE_ENABLED: "false",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      AUTH_MICROSOFT_ENABLED: "false",
      AUTH_SECRET: "production-reference-browser-test-auth-secret",
      AUTH_TWITTER_ENABLED: "false",
      AWS_ACCESS_KEY_ID: "",
      AWS_REGION: "",
      AWS_SECRET_ACCESS_KEY: "",
      BILLING_PROVIDER: "local",
      CREDENTIAL_ENCRYPTION_KEY: `${"A".repeat(43)}=`,
      DATABASE_URL:
        process.env.PLAYWRIGHT_DATABASE_URL ??
        "postgres://postgres:postgres@localhost:5432/supastack",
      EMAIL_PROVIDER: "local",
      EXPO_PUBLIC_API_URL: productionBaseURL,
      EXPO_PUBLIC_APP_SCHEME: "supastack",
      JOB_PROVIDER: "trigger",
      NEXT_PUBLIC_POSTHOG_HOST: "",
      NEXT_PUBLIC_POSTHOG_KEY: "",
      NEXT_TELEMETRY_DISABLED: "1",
      OPENAI_API_KEY: "",
      OPENAI_COMPATIBLE_API_KEY: "",
      OPENAI_COMPATIBLE_BASE_URL: "",
      RESEND_API_KEY: "",
      SENTRY_DSN: "",
      STRIPE_PRICE_ID: "",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      TRIGGER_PROJECT_REF: "proj_test",
      TRIGGER_SECRET_KEY: "tr_dev_test",
      MICROSOFT_CLIENT_ID: "",
      MICROSOFT_CLIENT_SECRET: "",
      TWITTER_CLIENT_ID: "",
      TWITTER_CLIENT_SECRET: "",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: productionBaseURL,
  },
});
