import { createHmac } from "node:crypto";

import type * as OpenAiSdk from "@ai-sdk/openai";
import type * as AiSdk from "ai";
import {
  AnthropicProvider,
  FakeAiProvider,
  OpenAiCompatibleProvider,
  OpenAiProvider,
  OpenRouterProvider,
} from "@supastack/ai";
import {
  CreemBillingAdapter,
  DodoBillingAdapter,
  LocalBillingService,
  PaddleBillingAdapter,
  PaypalBillingAdapter,
  PolarBillingAdapter,
  StripeBillingAdapter,
  WhopBillingAdapter,
  encodePaypalWebhookSignature,
  encodeStandardWebhookSignature,
} from "@supastack/billing";
import { parseServerConfig } from "@supastack/config";
import { HtmlTemplatedEmailSender } from "@supastack/email";
import { LocalJobRunner, TriggerJobRunner } from "@supastack/jobs";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@ai-sdk/openai", async (importOriginal) => ({
  ...(await importOriginal<typeof OpenAiSdk>()),
  createOpenAI: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof AiSdk>()),
  generateText: vi.fn(),
}));

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import {
  createServerBillingAdapter,
  createServerProviderComposition,
} from "./server-provider-composition.js";

describe("createServerProviderComposition", () => {
  it("keeps fake and local adapters as the credential-free default", () => {
    const composition = createServerProviderComposition({
      serverConfig: parseServerConfig({}),
    });

    expect(composition.ai).toBeInstanceOf(FakeAiProvider);
    expect(composition.billing).toBeInstanceOf(LocalBillingService);
    expect(composition.email).toBeInstanceOf(HtmlTemplatedEmailSender);
    expect(composition.jobs).toBeInstanceOf(LocalJobRunner);
    expect(createServerBillingAdapter(parseServerConfig({}).providers.billing)).toBeInstanceOf(
      LocalBillingService,
    );
  });

  it("maps selected providers to injected SDK factories and resolves the configured platform key", async () => {
    const calls: unknown[] = [];
    const composition = createServerProviderComposition({
      factories: {
        createOpenAiClient(config) {
          calls.push(["openai", config]);
          return {
            async generate(input) {
              calls.push(["openai.generate", input]);
              return {
                text: "Provider response",
                usage: { inputTokens: 3, outputTokens: 2 },
              };
            },
          };
        },
        createResendClient(config) {
          calls.push(["resend", config]);
          return {
            emails: {
              async send() {
                return { data: { id: "email_123" }, error: null };
              },
            },
          };
        },
        createSesClient() {
          throw new Error("must not create SES");
        },
        createStripeClient(config) {
          calls.push(["stripe", config]);
          return {
            billingPortal: {
              sessions: {
                async create() {
                  return { url: "https://example.test" };
                },
              },
            },
            checkout: {
              sessions: {
                async create() {
                  return { id: "cs_123", url: null };
                },
              },
            },
            webhooks: {
              constructEvent() {
                throw new Error("not invoked");
              },
            },
          };
        },
        createTriggerClient(config) {
          calls.push(["trigger", config]);
          return {
            runs: {
              async cancel(runId) {
                return { id: runId };
              },
              async retrieve(runId) {
                return { id: runId, status: "QUEUED" };
              },
            },
            tasks: {
              async trigger() {
                return { id: "run_123" };
              },
            },
          };
        },
      },
      serverConfig: parseServerConfig({
        AI_PROVIDER: "openai",
        BILLING_PROVIDER: "stripe",
        EMAIL_PROVIDER: "resend",
        JOB_PROVIDER: "trigger",
        OPENAI_API_KEY: "test-openai-key",
        RESEND_API_KEY: "test-resend-key",
        STRIPE_PRICE_ID: "price_test",
        STRIPE_SECRET_KEY: "test-stripe-key",
        STRIPE_WEBHOOK_SECRET: "test-stripe-webhook-secret",
        TRIGGER_PROJECT_REF: "proj_test",
        TRIGGER_SECRET_KEY: "test-trigger-key",
      }),
    });

    expect(composition.ai).toBeInstanceOf(OpenAiProvider);
    expect(composition.billing).toBeInstanceOf(StripeBillingAdapter);
    expect(composition.email).toBeInstanceOf(HtmlTemplatedEmailSender);
    expect(composition.jobs).toBeInstanceOf(TriggerJobRunner);
    expect(calls).toEqual([
      ["openai", { apiKey: "test-openai-key", kind: "openai" }],
      [
        "stripe",
        {
          kind: "stripe",
          priceId: "price_test",
          secretKey: "test-stripe-key",
          webhookSecret: "test-stripe-webhook-secret",
        },
      ],
      [
        "resend",
        {
          apiKey: "test-resend-key",
          from: "supastack <hello@example.test>",
          kind: "resend",
        },
      ],
      ["trigger", { kind: "trigger", projectRef: "proj_test", secretKey: "test-trigger-key" }],
    ]);

    await expect(
      composition.ai.complete({
        input: { prompt: "Summarize this request." },
        model: {
          id: "openai:gpt-4.1-mini",
          model: "gpt-4.1-mini",
          modelVersion: "2026-09-04",
          provider: "openai",
        },
        workspace: { budget: null, keyMode: "platform", workspaceId: "workspace-a" },
      }),
    ).resolves.toEqual({
      text: "Provider response",
      usage: { inputTokens: 3n, outputTokens: 2n },
    });
    expect(calls.at(-1)).toEqual([
      "openai.generate",
      {
        apiKey: "test-openai-key",
        input: { prompt: "Summarize this request." },
        model: "gpt-4.1-mini",
      },
    ]);
  });

  it("does not substitute the platform OpenAI key for a BYOK request", async () => {
    const composition = createServerProviderComposition({
      factories: {
        createOpenAiClient() {
          return {
            async generate() {
              throw new Error("must not call the AI SDK");
            },
          };
        },
        createResendClient() {
          throw new Error("must not create Resend");
        },
        createSesClient() {
          throw new Error("must not create SES");
        },
        createStripeClient() {
          throw new Error("must not create Stripe");
        },
        createTriggerClient() {
          throw new Error("must not create Trigger");
        },
      },
      serverConfig: parseServerConfig({
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "test-openai-key",
      }),
    });

    await expect(
      composition.ai.complete({
        input: "Summarize this request.",
        model: {
          id: "openai:gpt-4.1-mini",
          model: "gpt-4.1-mini",
          modelVersion: "2026-09-04",
          provider: "openai",
        },
        workspace: { budget: null, keyMode: "byok", workspaceId: "workspace-a" },
      }),
    ).rejects.toMatchObject({
      name: "AiProviderError",
      retryable: false,
    });
  });

  it.each([
    {
      config: {
        AI_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "test-anthropic-key",
      },
      expectedApiKey: "test-anthropic-key",
      expectedClass: AnthropicProvider,
      factory: "createAnthropicClient" as const,
      provider: "anthropic",
    },
    {
      config: {
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_API_KEY: "test-compatible-key",
        OPENAI_COMPATIBLE_BASE_URL: "https://models.example.test/v1",
      },
      expectedApiKey: "test-compatible-key",
      expectedClass: OpenAiCompatibleProvider,
      factory: "createOpenAiCompatibleClient" as const,
      provider: "openai-compatible",
    },
    {
      config: {
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "test-openrouter-key",
        OPENROUTER_APP_NAME: "Test App",
        OPENROUTER_SITE_URL: "https://app.example.test",
      },
      expectedApiKey: "test-openrouter-key",
      expectedClass: OpenRouterProvider,
      factory: "createOpenRouterClient" as const,
      provider: "openrouter",
    },
  ])("composes the $provider provider with its configured platform key", async (scenario) => {
    const generate = vi.fn(async () => ({
      text: "Provider response",
      usage: { inputTokens: 2, outputTokens: 1 },
    }));
    const factories = {
      createAnthropicClient: () => ({ generate }),
      createOpenAiClient: () => ({ generate }),
      createOpenAiCompatibleClient: () => ({ generate }),
      createOpenRouterClient: () => ({ generate }),
      createResendClient: () => {
        throw new Error("must not create Resend");
      },
      createSesClient: () => {
        throw new Error("must not create SES");
      },
      createStripeClient: () => {
        throw new Error("must not create Stripe");
      },
      createTriggerClient: () => {
        throw new Error("must not create Trigger");
      },
    };
    const composition = createServerProviderComposition({
      factories,
      serverConfig: parseServerConfig(scenario.config),
    });

    expect(composition.ai).toBeInstanceOf(scenario.expectedClass);
    await composition.ai.complete({
      input: "hello",
      model: {
        id: `${scenario.provider}:model-test`,
        model: "model-test",
        modelVersion: "1",
        provider: scenario.provider,
      },
      workspace: { budget: null, keyMode: "platform", workspaceId: "workspace-a" },
    });
    expect(generate).toHaveBeenCalledWith({
      apiKey: scenario.expectedApiKey,
      input: "hello",
      model: "model-test",
    });
  });

  it("composes the existing SES transactional adapter without sending a message", () => {
    const composition = createServerProviderComposition({
      serverConfig: parseServerConfig({
        AWS_ACCESS_KEY_ID: "test-access-key",
        AWS_REGION: "ca-central-1",
        AWS_SECRET_ACCESS_KEY: "test-secret-key",
        EMAIL_PROVIDER: "ses",
      }),
    });

    expect(composition.email).toBeInstanceOf(HtmlTemplatedEmailSender);
  });

  it("normalizes a signed current-version Stripe invoice without a network call", () => {
    const webhookSecret = "whsec_offline_contract";
    const payload = JSON.stringify({
      api_version: "2026-08-26.dahlia",
      created: 1_788_566_400,
      data: {
        object: {
          customer: "cus_123",
          id: "in_123",
          metadata: {},
          object: "invoice",
          parent: {
            quote_details: null,
            subscription_details: {
              metadata: {
                entitlement: "ai.reference-task",
                priceId: "price_monthly",
                workspaceId: "workspace-a",
              },
              subscription: "sub_123",
            },
            type: "subscription_details",
          },
        },
      },
      id: "evt_invoice_failed",
      livemode: false,
      object: "event",
      pending_webhooks: 1,
      request: null,
      type: "invoice.payment_failed",
    });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
    const composition = createServerProviderComposition({
      serverConfig: parseServerConfig({
        BILLING_PROVIDER: "stripe",
        STRIPE_PRICE_ID: "price_monthly",
        STRIPE_SECRET_KEY: "test-stripe-key",
        STRIPE_WEBHOOK_SECRET: webhookSecret,
      }),
    });

    expect(composition.billing).toBeInstanceOf(StripeBillingAdapter);
    if (!(composition.billing instanceof StripeBillingAdapter)) {
      throw new Error("expected the Stripe billing adapter");
    }

    expect(composition.billing.verifySignedWebhook({ payload, signature, webhookSecret })).toEqual({
      verification: "verified",
      event: {
        customerId: "cus_123",
        entitlement: "ai.reference-task",
        entitlementStatus: "past_due",
        eventId: "evt_invoice_failed",
        eventType: "invoice.payment_failed",
        occurredAt: new Date("2026-09-05T00:00:00.000Z"),
        priceId: "price_monthly",
        subscriptionId: "sub_123",
        workspaceId: "workspace-a",
      },
    });
  });

  it("composes the Creem adapter and verifies a signed webhook offline", () => {
    const webhookSecret = "creem_test_secret";
    const payload = JSON.stringify({
      created_at: 1_727_000_000_000,
      eventType: "subscription.canceled",
      id: "evt_creem_1",
      object: {
        customer: { id: "cust_123" },
        id: "sub_123",
        metadata: {
          entitlement: "ai.reference-task",
          workspaceId: "workspace-a",
        },
        object: "subscription",
        status: "canceled",
      },
    });
    const signature = createHmac("sha256", webhookSecret).update(payload).digest("hex");
    const composition = createServerProviderComposition({
      serverConfig: parseServerConfig({
        BILLING_PROVIDER: "creem",
        CREEM_API_KEY: "creem_test_key",
        CREEM_PRODUCT_ID: "prod_test",
        CREEM_WEBHOOK_SECRET: webhookSecret,
      }),
    });

    expect(composition.billing).toBeInstanceOf(CreemBillingAdapter);
    if (!(composition.billing instanceof CreemBillingAdapter)) {
      throw new Error("expected the Creem billing adapter");
    }

    expect(composition.billing.verifySignedWebhook({ payload, signature, webhookSecret })).toEqual({
      verification: "verified",
      event: {
        customerId: "cust_123",
        entitlement: "ai.reference-task",
        entitlementStatus: "inactive",
        eventId: "evt_creem_1",
        eventType: "subscription.canceled",
        occurredAt: new Date(1_727_000_000_000),
        subscriptionId: "sub_123",
        workspaceId: "workspace-a",
      },
    });
  });

  it("routes email-sdk providers through an injected client with telemetry off", async () => {
    const sent: unknown[] = [];
    for (const [provider, environment] of [
      ["postmark", { POSTMARK_SERVER_TOKEN: "pm_token" }],
      ["sendgrid", { SENDGRID_API_KEY: "sg_key" }],
      ["mailgun", { MAILGUN_API_KEY: "mg_key", MAILGUN_DOMAIN: "mg.example.test" }],
      ["smtp", { SMTP_HOST: "smtp.example.test" }],
      ["brevo", { BREVO_API_KEY: "brevo_key" }],
    ] as const) {
      const composition = createServerProviderComposition({
        factories: {
          createEmailSdkClient(config) {
            expect(config.kind).toBe(provider);
            return {
              async send(message) {
                sent.push(message);
                return { id: `sdk_${provider}` };
              },
            };
          },
          createOpenAiClient() {
            throw new Error("openai client must not be constructed");
          },
          createResendClient() {
            throw new Error("resend client must not be constructed");
          },
          createSesClient() {
            throw new Error("ses client must not be constructed");
          },
          createStripeClient() {
            throw new Error("stripe client must not be constructed");
          },
          createTriggerClient() {
            throw new Error("trigger client must not be constructed");
          },
        },
        serverConfig: parseServerConfig({ EMAIL_PROVIDER: provider, ...environment }),
      });

      const delivery = await composition.email.send({
        category: "transactional",
        subject: "Sign in",
        text: "hello",
        to: "user@example.test",
        workspaceId: "workspace-a",
      });
      expect(delivery.id).toBe(`sdk_${provider}`);
    }
    expect(sent).toHaveLength(5);
  });

  it("composes the Polar adapter and verifies a Standard Webhooks payload offline", () => {
    // Polar's `validateEvent` HMACs with the literal secret bytes.
    const webhookSecret = "polar_test_secret";
    // The SDK's `validateEvent` schema-validates the full wire shape, so the
    // fixture must be a complete Subscription (customer + product included).
    const payload = JSON.stringify({
      data: {
        amount: 2900,
        cancel_at_period_end: false,
        canceled_at: null,
        checkout_id: null,
        created_at: "2026-09-01T00:00:00.000Z",
        currency: "usd",
        current_meter_period_end: null,
        current_meter_period_start: null,
        current_period_end: "2026-10-01T00:00:00.000Z",
        current_period_start: "2026-09-01T00:00:00.000Z",
        customer: {
          avatar_url: null,
          billing_address: null,
          billing_name: null,
          created_at: "2026-09-01T00:00:00.000Z",
          deleted_at: null,
          email_verified: false,
          id: "cust_123",
          metadata: {},
          modified_at: null,
          name: null,
          organization_id: "org_1",
          tax_id: null,
          type: "individual",
        },
        customer_cancellation_comment: null,
        customer_cancellation_reason: null,
        customer_id: "cust_123",
        discount: null,
        discount_id: null,
        ended_at: null,
        ends_at: null,
        id: "sub_123",
        metadata: {
          entitlement: "ai.reference-task",
          priceId: "prod_123",
          workspaceId: "workspace-a",
        },
        meters: [],
        modified_at: null,
        pause_at_period_end: false,
        paused_at: null,
        pending_update: null,
        prices: [],
        product: {
          attached_custom_fields: [],
          benefits: [],
          created_at: "2026-09-01T00:00:00.000Z",
          description: null,
          id: "prod_123",
          is_archived: false,
          is_recurring: true,
          medias: [],
          metadata: {},
          meter_interval: null,
          meter_interval_count: null,
          modified_at: null,
          name: "Pro",
          organization_id: "org_1",
          prices: [],
          recurring_interval: "month",
          recurring_interval_count: 1,
          trial_interval: null,
          trial_interval_count: null,
          visibility: "public",
        },
        product_id: "prod_123",
        recurring_interval: "month",
        recurring_interval_count: 1,
        resumes_at: null,
        started_at: "2026-09-01T00:00:00.000Z",
        status: "active",
        trial_end: null,
        trial_start: null,
      },
      timestamp: "2026-09-22T00:00:00.000Z",
      type: "subscription.active",
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = encodeStandardWebhookSignature({
      "webhook-id": "msg_polar_1",
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${createHmac("sha256", webhookSecret)
        .update(`msg_polar_1.${timestamp}.${payload}`)
        .digest("base64")}`,
    });
    const composition = createServerProviderComposition({
      serverConfig: parseServerConfig({
        BILLING_PROVIDER: "polar",
        POLAR_ACCESS_TOKEN: "polar_test_token",
        POLAR_PRODUCT_ID: "prod_123",
        POLAR_WEBHOOK_SECRET: webhookSecret,
      }),
    });

    expect(composition.billing).toBeInstanceOf(PolarBillingAdapter);
    if (!(composition.billing instanceof PolarBillingAdapter)) {
      throw new Error("expected the Polar billing adapter");
    }

    expect(composition.billing.verifySignedWebhook({ payload, signature, webhookSecret })).toEqual({
      verification: "verified",
      event: {
        customerId: "cust_123",
        entitlement: "ai.reference-task",
        entitlementStatus: "active",
        eventId: "msg_polar_1",
        eventType: "subscription.active",
        occurredAt: new Date("2026-09-22T00:00:00.000Z"),
        priceId: "prod_123",
        subscriptionId: "sub_123",
        workspaceId: "workspace-a",
      },
    });
  });

  it("composes the Whop adapter and verifies a Standard Webhooks payload offline", () => {
    // `unwrapWebhook` HMACs with the literal secret bytes.
    const webhookSecret = "ws_test_secret";
    const payload = JSON.stringify({
      data: {
        id: "pay_123",
        membership_id: "mem_555",
        metadata: {
          entitlement: "ai.reference-task",
          priceId: "plan_555",
          workspaceId: "workspace-a",
        },
      },
      id: "evt_whop_1",
      timestamp: "2026-09-22T00:00:00.000Z",
      type: "payment.succeeded",
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = encodeStandardWebhookSignature({
      "webhook-id": "msg_whop_1",
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${createHmac("sha256", webhookSecret)
        .update(`msg_whop_1.${timestamp}.${payload}`)
        .digest("base64")}`,
    });
    const composition = createServerProviderComposition({
      serverConfig: parseServerConfig({
        BILLING_PROVIDER: "whop",
        WHOP_API_KEY: "whop_test_key",
        WHOP_PLAN_ID: "plan_555",
        WHOP_WEBHOOK_SECRET: webhookSecret,
      }),
    });

    expect(composition.billing).toBeInstanceOf(WhopBillingAdapter);
    if (!(composition.billing instanceof WhopBillingAdapter)) {
      throw new Error("expected the Whop billing adapter");
    }

    expect(composition.billing.verifySignedWebhook({ payload, signature, webhookSecret })).toEqual({
      verification: "verified",
      event: {
        customerId: "mem_555",
        entitlement: "ai.reference-task",
        entitlementStatus: "active",
        eventId: "evt_whop_1",
        eventType: "payment.succeeded",
        occurredAt: new Date("2026-09-22T00:00:00.000Z"),
        priceId: "plan_555",
        subscriptionId: "mem_555",
        workspaceId: "workspace-a",
      },
    });
  });

  it("composes the Paddle adapter and verifies a Paddle-Signature payload offline", () => {
    const webhookSecret = "pdl_test_secret";
    const payload = JSON.stringify({
      data: {
        custom_data: {
          entitlement: "ai.reference-task",
          priceId: "pri_123",
          workspaceId: "workspace-a",
        },
        customer_id: "ctm_123",
        id: "sub_123",
        status: "active",
      },
      event_id: "evt_paddle_1",
      event_type: "subscription.activated",
      notification_id: "ntf_1",
      occurred_at: "2026-09-22T00:00:00.000Z",
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `ts=${timestamp};h1=${createHmac("sha256", webhookSecret)
      .update(`${timestamp}:${payload}`)
      .digest("hex")}`;
    const composition = createServerProviderComposition({
      serverConfig: parseServerConfig({
        BILLING_PROVIDER: "paddle",
        PADDLE_API_KEY: "paddle_test_key",
        PADDLE_PRICE_ID: "pri_123",
        PADDLE_WEBHOOK_SECRET: webhookSecret,
      }),
    });

    expect(composition.billing).toBeInstanceOf(PaddleBillingAdapter);
    if (!(composition.billing instanceof PaddleBillingAdapter)) {
      throw new Error("expected the Paddle billing adapter");
    }

    expect(composition.billing.verifySignedWebhook({ payload, signature, webhookSecret })).toEqual({
      verification: "verified",
      event: {
        customerId: "ctm_123",
        entitlement: "ai.reference-task",
        entitlementStatus: "active",
        eventId: "evt_paddle_1",
        eventType: "subscription.activated",
        occurredAt: new Date("2026-09-22T00:00:00.000Z"),
        priceId: "pri_123",
        subscriptionId: "sub_123",
        workspaceId: "workspace-a",
      },
    });
  });

  it("composes the Dodo Payments adapter and verifies a Standard Webhooks payload offline", () => {
    // The adapter verifies Standard Webhooks locally with the literal secret bytes.
    const webhookSecret = "dodo_test_key";
    const payload = JSON.stringify({
      business_id: "biz_1",
      data: {
        customer: { customer_id: "cus_123" },
        metadata: {
          entitlement: "ai.reference-task",
          priceId: "pdt_123",
          workspaceId: "workspace-a",
        },
        payload_type: "Subscription",
        status: "cancelled",
        subscription_id: "sub_123",
      },
      timestamp: "2026-09-22T00:00:00.000Z",
      type: "subscription.cancelled",
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = encodeStandardWebhookSignature({
      "webhook-id": "msg_dodo_1",
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${createHmac("sha256", Buffer.from(webhookSecret, "utf8"))
        .update(`msg_dodo_1.${timestamp}.${payload}`)
        .digest("base64")}`,
    });
    const composition = createServerProviderComposition({
      serverConfig: parseServerConfig({
        BILLING_PROVIDER: "dodo",
        DODO_PAYMENTS_API_KEY: "dodo_test_key",
        DODO_PAYMENTS_WEBHOOK_KEY: webhookSecret,
        DODO_PRODUCT_ID: "pdt_123",
      }),
    });

    expect(composition.billing).toBeInstanceOf(DodoBillingAdapter);
    if (!(composition.billing instanceof DodoBillingAdapter)) {
      throw new Error("expected the Dodo Payments billing adapter");
    }

    expect(composition.billing.verifySignedWebhook({ payload, signature, webhookSecret })).toEqual({
      verification: "verified",
      event: {
        customerId: "cus_123",
        entitlement: "ai.reference-task",
        entitlementStatus: "inactive",
        eventId: "msg_dodo_1",
        eventType: "subscription.cancelled",
        occurredAt: new Date("2026-09-22T00:00:00.000Z"),
        priceId: "pdt_123",
        subscriptionId: "sub_123",
        workspaceId: "workspace-a",
      },
    });
  });

  it("composes the PayPal adapter and verifies through the injected client", async () => {
    const webhookId = "WH_test_1";
    const payload = JSON.stringify({
      create_time: "2026-09-22T00:00:00.000Z",
      event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
      id: "WH-evt-1",
      resource: {
        custom_id: JSON.stringify({
          e: "ai.reference-task",
          p: "P-123",
          w: "workspace-a",
        }),
        id: "I-ABC123",
        plan_id: "P-123",
        status: "ACTIVE",
        subscriber: { payer_id: "PAYER42" },
      },
      resource_type: "subscription",
    });
    const signature = encodePaypalWebhookSignature({
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.paypal.com/certs/cert.pem",
      "paypal-transmission-id": "tx_1",
      "paypal-transmission-sig": "sig_1",
      "paypal-transmission-time": "2026-09-22T00:00:00.000Z",
    });
    const composition = createServerProviderComposition({
      factories: {
        createOpenAiClient() {
          throw new Error("openai client must not be constructed");
        },
        createPaypalClient(config) {
          expect(config).toMatchObject({ environment: "sandbox", kind: "paypal" });
          return {
            async createSubscription() {
              return { id: "I-NEW", url: "https://paypal.test/approve" };
            },
            async subscriptionPortalUrl() {
              return { url: "https://www.sandbox.paypal.com/myaccount/autopay/" };
            },
            async verifyWebhookSignature(input) {
              expect(input.webhookId).toBe(webhookId);
              return { verificationStatus: "SUCCESS" };
            },
          };
        },
        createResendClient() {
          throw new Error("resend client must not be constructed");
        },
        createSesClient() {
          throw new Error("ses client must not be constructed");
        },
        createStripeClient() {
          throw new Error("stripe client must not be constructed");
        },
        createTriggerClient() {
          throw new Error("trigger client must not be constructed");
        },
      },
      serverConfig: parseServerConfig({
        BILLING_PROVIDER: "paypal",
        PAYPAL_CLIENT_ID: "paypal_cid",
        PAYPAL_CLIENT_SECRET: "paypal_secret",
        PAYPAL_PLAN_ID: "P-123",
        PAYPAL_WEBHOOK_ID: webhookId,
      }),
    });

    expect(composition.billing).toBeInstanceOf(PaypalBillingAdapter);
    if (!(composition.billing instanceof PaypalBillingAdapter)) {
      throw new Error("expected the PayPal billing adapter");
    }

    await expect(
      composition.billing.verifySignedWebhook({ payload, signature, webhookSecret: webhookId }),
    ).resolves.toEqual({
      verification: "verified",
      event: {
        customerId: "PAYER42",
        entitlement: "ai.reference-task",
        entitlementStatus: "active",
        eventId: "WH-evt-1",
        eventType: "BILLING.SUBSCRIPTION.ACTIVATED",
        occurredAt: new Date("2026-09-22T00:00:00.000Z"),
        priceId: "P-123",
        subscriptionId: "I-ABC123",
        workspaceId: "workspace-a",
      },
    });
  });
});

describe("openai-compatible transport", () => {
  it("routes through .chat() and forwards abort signals to the provider SDK", async () => {
    const chatModel = { tag: "chat-completions-model" };
    const chat = vi.fn(() => chatModel);
    const shorthand = Object.assign(
      vi.fn(() => {
        throw new Error("Responses API transport must not be used for openai-compatible");
      }),
      { chat },
    );
    vi.mocked(createOpenAI).mockReturnValue(shorthand as never);
    vi.mocked(generateText).mockResolvedValue({
      text: "OK",
      totalUsage: { inputTokens: 5, outputTokens: 3 },
    } as never);

    const composition = createServerProviderComposition({
      serverConfig: parseServerConfig({
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_API_KEY: "test-key",
        OPENAI_COMPATIBLE_BASE_URL: "https://gateway.example.test/v1",
      }),
    });

    const controller = new AbortController();
    const completion = await composition.ai.complete({
      input: "hello",
      model: {
        id: "oc-model-1",
        model: "mf/deepseek-v4.1-flash",
        modelVersion: "v4.1-flash",
        provider: "openai-compatible",
      },
      signal: controller.signal,
      workspace: { budget: null, keyMode: "platform", workspaceId: "workspace-1" },
    });

    expect(chat).toHaveBeenCalledWith("mf/deepseek-v4.1-flash");
    expect(vi.mocked(generateText).mock.calls[0]?.[0]).toMatchObject({
      abortSignal: controller.signal,
      model: chatModel,
    });
    expect(completion.text).toBe("OK");
  });
});
