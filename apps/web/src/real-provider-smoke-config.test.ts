import { describe, expect, it } from "vitest";

import { parseRealProviderSmokeConfig } from "./real-provider-smoke-config.js";

const realSmokeEnvironment = {
  AI_PROVIDER: "openai",
  APP_URL: "https://app.example.test",
  BILLING_PROVIDER: "stripe",
  EMAIL_PROVIDER: "resend",
  OPENAI_API_KEY: "test-openai-key",
  REAL_SMOKE_AI_MODEL: "provider-model-id",
  REAL_SMOKE_AI_MODEL_VERSION: "2026-09-04",
  REAL_SMOKE_EMAIL_ALLOWED_DOMAIN: "example.test",
  REAL_SMOKE_EMAIL_TO: "smoke@example.test",
  REAL_SMOKE_STRIPE_MODE: "sandbox",
  REAL_SMOKE_TRIGGER_PROJECT_REF: "proj_smoke_test",
  REAL_SMOKE_WORKSPACE_ID: "workspace-smoke",
  RESEND_API_KEY: "test-resend-key",
  RUN_REAL_PROVIDER_SMOKE: "true",
  STRIPE_PRICE_ID: "price_test",
  STRIPE_SECRET_KEY: "test-stripe-key",
  STRIPE_WEBHOOK_SECRET: "test-webhook-secret",
} as const;

describe("real provider smoke configuration", () => {
  it("fails closed without explicit network opt-in", () => {
    expect(() =>
      parseRealProviderSmokeConfig({ ...realSmokeEnvironment, RUN_REAL_PROVIDER_SMOKE: "false" }),
    ).toThrow("RUN_REAL_PROVIDER_SMOKE=true");
  });

  it("requires real AI, email, and Stripe selections", () => {
    expect(() =>
      parseRealProviderSmokeConfig({ ...realSmokeEnvironment, AI_PROVIDER: "fake" }),
    ).toThrow("OpenAI");
    expect(() =>
      parseRealProviderSmokeConfig({ ...realSmokeEnvironment, EMAIL_PROVIDER: "local" }),
    ).toThrow("Resend or SES");
    expect(() =>
      parseRealProviderSmokeConfig({ ...realSmokeEnvironment, BILLING_PROVIDER: "local" }),
    ).toThrow("Stripe sandbox");
    expect(() =>
      parseRealProviderSmokeConfig({ ...realSmokeEnvironment, REAL_SMOKE_STRIPE_MODE: "live" }),
    ).toThrow("sandbox");
  });

  it("returns only the operator inputs needed by the smoke runner", () => {
    const parsed = parseRealProviderSmokeConfig(realSmokeEnvironment);

    expect(parsed.aiModel).toBe("provider-model-id");
    expect(parsed.aiModelVersion).toBe("2026-09-04");
    expect(parsed.emailAllowedDomain).toBe("example.test");
    expect(parsed.emailTo).toBe("smoke@example.test");
    expect(parsed.serverConfig.providers.ai.kind).toBe("openai");
    expect(parsed.serverConfig.providers.email.kind).toBe("resend");
    expect(parsed.serverConfig.providers.billing.kind).toBe("stripe");
    expect(parsed.triggerTask).toBeNull();
    expect(parsed.workspaceId).toBe("workspace-smoke");
  });

  it("requires a deployed task name when Trigger.dev is selected", () => {
    expect(() =>
      parseRealProviderSmokeConfig({
        ...realSmokeEnvironment,
        JOB_PROVIDER: "trigger",
        TRIGGER_PROJECT_REF: "proj_test",
        TRIGGER_SECRET_KEY: "test-trigger-key",
      }),
    ).toThrow("REAL_SMOKE_TRIGGER_TASK");

    expect(
      parseRealProviderSmokeConfig({
        ...realSmokeEnvironment,
        JOB_PROVIDER: "trigger",
        REAL_SMOKE_TRIGGER_PROJECT_REF: "proj_test",
        REAL_SMOKE_TRIGGER_TASK: "smoke.reference-ai-generate",
        TRIGGER_PROJECT_REF: "proj_test",
        TRIGGER_SECRET_KEY: "test-trigger-key",
      }).triggerTask,
    ).toBe("smoke.reference-ai-generate");
  });

  it("requires a strict allowlisted smoke recipient and an explicitly matched Trigger project", () => {
    expect(() =>
      parseRealProviderSmokeConfig({
        ...realSmokeEnvironment,
        REAL_SMOKE_EMAIL_TO: "smoke@example.test,other@example.test",
      }),
    ).toThrow("valid email address");
    expect(() =>
      parseRealProviderSmokeConfig({
        ...realSmokeEnvironment,
        REAL_SMOKE_EMAIL_TO: "smoke@another.test",
      }),
    ).toThrow("REAL_SMOKE_EMAIL_ALLOWED_DOMAIN");
    expect(() =>
      parseRealProviderSmokeConfig({
        ...realSmokeEnvironment,
        JOB_PROVIDER: "trigger",
        REAL_SMOKE_TRIGGER_PROJECT_REF: "proj_other",
        REAL_SMOKE_TRIGGER_TASK: "smoke.reference-ai-generate",
        TRIGGER_PROJECT_REF: "proj_test",
        TRIGGER_SECRET_KEY: "test-trigger-key",
      }),
    ).toThrow("REAL_SMOKE_TRIGGER_PROJECT_REF");
    expect(() =>
      parseRealProviderSmokeConfig({
        ...realSmokeEnvironment,
        JOB_PROVIDER: "trigger",
        REAL_SMOKE_TRIGGER_PROJECT_REF: "proj_test",
        REAL_SMOKE_TRIGGER_TASK: "reference-ai-generate",
        TRIGGER_PROJECT_REF: "proj_test",
        TRIGGER_SECRET_KEY: "test-trigger-key",
      }),
    ).toThrow("smoke.");
  });
});
