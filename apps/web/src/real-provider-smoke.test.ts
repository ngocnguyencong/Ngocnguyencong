import { parseServerConfig } from "@supastack/config";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { RealProviderSmokeConfig } from "./real-provider-smoke-config.js";
import {
  realProviderSmokeAiGenerationLimits,
  runRealProviderSmoke,
} from "./real-provider-smoke.js";

const smokeConfig: RealProviderSmokeConfig = {
  aiModel: "provider-model-id",
  aiModelVersion: "2026-09-04",
  emailAllowedDomain: "example.test",
  emailTo: "smoke@example.test",
  serverConfig: parseServerConfig({
    AI_PROVIDER: "openai",
    APP_URL: "https://app.example.test",
    BILLING_PROVIDER: "stripe",
    EMAIL_PROVIDER: "resend",
    OPENAI_API_KEY: "test-openai-key",
    RESEND_API_KEY: "test-resend-key",
    STRIPE_PRICE_ID: "price_test",
    STRIPE_SECRET_KEY: "test-stripe-key",
    STRIPE_WEBHOOK_SECRET: "test-webhook-secret",
  }),
  triggerProjectRef: null,
  triggerTask: null,
  workspaceId: "workspace-smoke",
};

describe("runRealProviderSmoke", () => {
  it("uses a bounded AI call and only the approved connection operations", async () => {
    const calls: unknown[] = [];

    await runRealProviderSmoke({
      config: smokeConfig,
      createIntegrationIdentifier: () => "supastack_abcdefgh",
      createProviders(input) {
        calls.push(["compose", input.openAiGenerationLimits]);
        return {
          ai: {
            async complete(request) {
              calls.push(["ai", request]);
              return {
                text: "SUPASTACK_SMOKE_OK",
                usage: { inputTokens: 3n, outputTokens: 2n },
              };
            },
          },
          billing: {
            async createCheckoutSession(request) {
              calls.push(["billing", request]);
              return { id: "cs_smoke", url: "https://checkout.example.test/cs_smoke" };
            },
          },
          email: {
            async send(request) {
              calls.push(["email", request]);
              return {
                id: "email_smoke",
                status: "queued",
                subject: request.subject,
                text: request.text,
                to: request.to,
                workspaceId: request.workspaceId,
              };
            },
          },
          jobs: {
            async enqueue() {
              throw new Error("must not enqueue a local-only smoke");
            },
          },
        };
      },
    });

    expect(calls).toEqual([
      ["compose", realProviderSmokeAiGenerationLimits],
      [
        "ai",
        {
          input: "Reply with only: SUPASTACK_SMOKE_OK",
          model: {
            id: "openai:provider-model-id",
            model: "provider-model-id",
            modelVersion: "2026-09-04",
            provider: "openai",
          },
          workspace: { budget: null, keyMode: "platform", workspaceId: "workspace-smoke" },
        },
      ],
      [
        "email",
        {
          category: "transactional",
          subject: "supastack provider smoke",
          text: "Transactional provider connection verified. No action is required.",
          to: "smoke@example.test",
          workspaceId: "workspace-smoke",
        },
      ],
      [
        "billing",
        {
          cancelUrl: "https://app.example.test/billing?checkout=cancelled",
          customerEmail: "smoke@example.test",
          entitlement: "ai.reference-task",
          idempotencyKey: "provider-smoke-workspace-smoke",
          integrationIdentifier: "supastack_abcdefgh",
          priceId: "price_test",
          successUrl: "https://app.example.test/billing?checkout=success",
          workspaceId: "workspace-smoke",
        },
      ],
    ]);
  });

  it("enqueues only the verified dedicated Trigger smoke task", async () => {
    const calls: unknown[] = [];
    const config: RealProviderSmokeConfig = {
      ...smokeConfig,
      triggerProjectRef: "proj_smoke_test",
      triggerTask: "smoke.reference-ai-generate",
    };

    await runRealProviderSmoke({
      config,
      createIntegrationIdentifier: () => "supastack_abcdefgh",
      createProviders() {
        return {
          ai: {
            async complete() {
              return { text: "SUPASTACK_SMOKE_OK", usage: { inputTokens: 1n, outputTokens: 1n } };
            },
          },
          billing: {
            async createCheckoutSession() {
              return { id: "cs_smoke", url: "https://checkout.example.test/cs_smoke" };
            },
          },
          email: {
            async send(request) {
              return {
                id: "email_smoke",
                status: "queued",
                subject: request.subject,
                text: request.text,
                to: request.to,
                workspaceId: request.workspaceId,
              };
            },
          },
          jobs: {
            async enqueue(request) {
              calls.push(request);
              return {
                id: "run_smoke",
                input: request.input,
                status: "queued",
                type: request.type,
                workspaceId: request.workspaceId,
              };
            },
          },
        };
      },
    });

    expect(calls).toEqual([
      {
        input: { smoke: true },
        type: "smoke.reference-ai-generate",
        workspaceId: "workspace-smoke",
      },
    ]);
  });
});
