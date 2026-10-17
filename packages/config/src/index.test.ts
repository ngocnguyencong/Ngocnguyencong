import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { describe, expect, it } from "vitest";

import { parsePublicConfig, parseServerConfig, serverConfigSchema } from "./index.js";

describe("mobile purchases configuration", () => {
  it("is off without store credentials", () => {
    expect(parseServerConfig({}).mobilePurchases).toEqual({ kind: "off" });
    expect(parseServerConfig({ REVENUECAT_ALLOW_SANDBOX: "" }).mobilePurchases).toEqual({
      kind: "off",
    });
  });
  it("requires server-only RevenueCat verification credentials", () => {
    expect(() => parseServerConfig({ MOBILE_PURCHASES_PROVIDER: "revenuecat" })).toThrow(
      /REVENUECAT_SECRET_API_KEY/,
    );
  });
  it("forbids granting production access from sandbox purchases", () => {
    expect(() =>
      parseServerConfig({
        APP_ENV: "production",
        MOBILE_PURCHASES_PROVIDER: "revenuecat",
        REVENUECAT_SECRET_API_KEY: "test-only-key",
        REVENUECAT_WEBHOOK_AUTHORIZATION: "Bearer test-only-token",
        REVENUECAT_ALLOW_SANDBOX: "true",
      }),
    ).toThrow(/Sandbox purchases cannot grant production access/);
  });
  it("keeps purchase secrets out of the public projection", () => {
    const config = parseServerConfig({
      MOBILE_PURCHASES_PROVIDER: "revenuecat",
      REVENUECAT_SECRET_API_KEY: "test-only-secret",
      REVENUECAT_WEBHOOK_AUTHORIZATION: "Bearer test-only-webhook",
    });
    expect(config.mobilePurchases).toMatchObject({
      kind: "revenuecat",
      entitlementId: "pro",
      entitlementKey: "ai.reference-task",
      allowSandbox: true,
    });
    const serialized = JSON.stringify(parsePublicConfig(config));
    expect(serialized).not.toContain("test-only-secret");
    expect(serialized).not.toContain("test-only-webhook");
    expect(serialized).not.toContain("mobilePurchases");
  });
});

describe("parseServerConfig", () => {
  it("enforces production requirements when only the runtime environment is set", () => {
    expect(() => parseServerConfig({ NODE_ENV: "production" })).toThrow(/AUTH_SECRET/);
    expect(serverConfigSchema.safeParse({ NODE_ENV: "production" }).success).toBe(false);
    expect(parseServerConfig({ NODE_ENV: "test" }).app.environment).toBe("local");
    expect(parseServerConfig({ NODE_ENV: "production", APP_ENV: "local" }).app.environment).toBe(
      "local",
    );
  });
  it("accepts a fully configured production host without APP_ENV", () => {
    const config = parseServerConfig({
      NODE_ENV: "production",
      APP_URL: "https://app.example.com",
      AUTH_SECRET: "production-auth-secret-at-least-32-characters",
      CREDENTIAL_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      DATABASE_URL: "postgres://supastack:secret@db.example.com:5432/supastack",
      EXPO_PUBLIC_API_URL: "https://api.example.com",
      EXPO_PUBLIC_APP_SCHEME: "com.example.supastack",
      MOBILE_ALLOWED_ORIGINS: "https://app.example.com,https://api.example.com",
    });
    expect(config.app.environment).toBe("production");
  });
  it("boots with the shipped example environment", () => {
    const environment = parseEnv(
      readFileSync(new URL("../../../.env.example", import.meta.url), "utf8"),
    );

    expect(parseServerConfig(environment).providers).toMatchObject({
      ai: { kind: "fake" },
      billing: { kind: "local" },
      email: { kind: "local" },
    });
  });

  it.each(["", " \t ", undefined])("uses provider defaults for blank options (%j)", (value) => {
    expect(
      parseServerConfig({ CREEM_TEST_MODE: value, MAILGUN_REGION: value, SMTP_SECURE: value }),
    ).toEqual(parseServerConfig({}));

    expect(
      parseServerConfig({
        BILLING_PROVIDER: "creem",
        CREEM_API_KEY: "test-key",
        CREEM_PRODUCT_ID: "test-product",
        CREEM_WEBHOOK_SECRET: "test-webhook",
        CREEM_TEST_MODE: value,
      }).providers.billing,
    ).toMatchObject({ kind: "creem", testMode: false });
    expect(
      parseServerConfig({
        EMAIL_PROVIDER: "mailgun",
        MAILGUN_API_KEY: "test-key",
        MAILGUN_DOMAIN: "mg.example.test",
        MAILGUN_REGION: value,
      }).providers.email,
    ).toMatchObject({ kind: "mailgun", region: "us" });
    expect(
      parseServerConfig({
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "smtp.example.test",
        SMTP_SECURE: value,
      }).providers.email,
    ).toMatchObject({ kind: "smtp", secure: false });
  });

  it.each(["true", "false"])("preserves explicit provider boolean %s", (value) => {
    expect(
      parseServerConfig({
        BILLING_PROVIDER: "creem",
        CREEM_API_KEY: "test-key",
        CREEM_PRODUCT_ID: "test-product",
        CREEM_WEBHOOK_SECRET: "test-webhook",
        CREEM_TEST_MODE: value,
      }).providers.billing,
    ).toMatchObject({ testMode: value === "true" });
    expect(
      parseServerConfig({
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "smtp.example.test",
        SMTP_SECURE: value,
      }).providers.email,
    ).toMatchObject({ secure: value === "true" });
  });

  it.each(["us", "eu"])("preserves explicit Mailgun region %s", (region) => {
    expect(
      parseServerConfig({
        EMAIL_PROVIDER: "mailgun",
        MAILGUN_API_KEY: "test-key",
        MAILGUN_DOMAIN: "mg.example.test",
        MAILGUN_REGION: region,
      }).providers.email,
    ).toMatchObject({ region });
  });

  it.each([
    ["CREEM_TEST_MODE", "yes"],
    ["MAILGUN_REGION", "ap"],
    ["SMTP_SECURE", "yes"],
  ])("rejects invalid nonblank %s", (key, value) => {
    expect(() => parseServerConfig({ [key]: value })).toThrow(key);
  });

  it("uses fake and local adapters without requiring provider credentials", () => {
    const config = parseServerConfig({});

    expect(config.app.environment).toBe("local");
    expect(config.mobile.scheme).toBe("supastack");
    expect(config.providers).toEqual({
      ai: { kind: "fake" },
      analytics: { kind: "off" },
      billing: { kind: "local" },
      captcha: { kind: "off" },
      email: { kind: "local", from: "supastack <hello@example.test>" },
      jobs: { kind: "local" },
      storage: { kind: "memory" },
    });
  });

  it("requires Google credentials only when Google is enabled", () => {
    expect(() => parseServerConfig({ AUTH_GOOGLE_ENABLED: "true" })).toThrow(/GOOGLE_CLIENT_ID/);

    expect(
      parseServerConfig({
        AUTH_GOOGLE_ENABLED: "true",
        GOOGLE_CLIENT_ID: "google-client-id",
        GOOGLE_CLIENT_SECRET: "google-client-secret",
      }).auth.providers.google,
    ).toMatchObject({
      clientId: "google-client-id",
      enabled: true,
    });
  });

  it("makes the V1 auth registry explicit while leaving later OAuth providers disabled", () => {
    const config = parseServerConfig({});

    expect(config.auth.providers).toEqual({
      apple: { enabled: false },
      emailOtp: { enabled: true },
      github: { enabled: false },
      google: { enabled: false },
      microsoft: { enabled: false },
      password: { enabled: true },
      twitter: { enabled: false },
    });
  });

  it("requires OpenAI credentials only when OpenAI is selected", () => {
    expect(() => parseServerConfig({ AI_PROVIDER: "openai" })).toThrow(/OPENAI_API_KEY/);

    expect(
      parseServerConfig({
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "openai-api-key",
      }).providers.ai,
    ).toEqual({ kind: "openai", apiKey: "openai-api-key" });
  });

  it("requires an OpenRouter key only when OpenRouter is selected", () => {
    expect(() => parseServerConfig({ AI_PROVIDER: "openrouter" })).toThrow(/OPENROUTER_API_KEY/);

    expect(
      parseServerConfig({
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "openrouter-api-key",
      }).providers.ai,
    ).toEqual({ kind: "openrouter", apiKey: "openrouter-api-key" });

    expect(
      parseServerConfig({
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "openrouter-api-key",
        OPENROUTER_APP_NAME: "My App",
        OPENROUTER_SITE_URL: "https://app.example.test",
      }).providers.ai,
    ).toEqual({
      kind: "openrouter",
      apiKey: "openrouter-api-key",
      appName: "My App",
      siteUrl: "https://app.example.test",
    });
  });

  it("defaults the agent framework to ai-sdk and accepts each supported value", () => {
    expect(parseServerConfig({}).agents).toEqual({ framework: "ai-sdk" });

    for (const framework of ["ai-sdk", "mastra", "langgraph", "openai-agents"] as const) {
      expect(parseServerConfig({ AGENT_FRAMEWORK: framework }).agents).toEqual({ framework });
    }
  });

  it("requires Polar credentials only when Polar billing is selected", () => {
    expect(() => parseServerConfig({ BILLING_PROVIDER: "polar" })).toThrow(/POLAR_ACCESS_TOKEN/);
    expect(() =>
      parseServerConfig({ BILLING_PROVIDER: "polar", POLAR_ACCESS_TOKEN: "polar_at" }),
    ).toThrow(/POLAR_WEBHOOK_SECRET/);

    expect(
      parseServerConfig({
        BILLING_PROVIDER: "polar",
        POLAR_ACCESS_TOKEN: "polar_at",
        POLAR_PRODUCT_ID: "prod_123",
        POLAR_WEBHOOK_SECRET: "polar_whsec",
      }).providers.billing,
    ).toEqual({
      accessToken: "polar_at",
      kind: "polar",
      priceId: "prod_123",
      server: "sandbox",
      webhookSecret: "polar_whsec",
    });

    expect(
      parseServerConfig({
        BILLING_PROVIDER: "polar",
        POLAR_ACCESS_TOKEN: "polar_at",
        POLAR_PRODUCT_ID: "prod_123",
        POLAR_SERVER: "production",
        POLAR_WEBHOOK_SECRET: "polar_whsec",
      }).providers.billing,
    ).toMatchObject({ kind: "polar", server: "production" });
  });

  it("requires Whop credentials only when Whop billing is selected", () => {
    expect(() => parseServerConfig({ BILLING_PROVIDER: "whop" })).toThrow(/WHOP_API_KEY/);
    expect(() => parseServerConfig({ BILLING_PROVIDER: "whop", WHOP_API_KEY: "whop_key" })).toThrow(
      /WHOP_WEBHOOK_SECRET/,
    );

    expect(
      parseServerConfig({
        BILLING_PROVIDER: "whop",
        WHOP_API_KEY: "whop_key",
        WHOP_PLAN_ID: "plan_123",
        WHOP_WEBHOOK_SECRET: "ws_secret",
      }).providers.billing,
    ).toEqual({
      apiKey: "whop_key",
      kind: "whop",
      priceId: "plan_123",
      webhookSecret: "ws_secret",
    });
  });

  it("requires Paddle credentials only when Paddle billing is selected", () => {
    expect(() => parseServerConfig({ BILLING_PROVIDER: "paddle" })).toThrow(/PADDLE_API_KEY/);
    expect(() =>
      parseServerConfig({ BILLING_PROVIDER: "paddle", PADDLE_API_KEY: "paddle_key" }),
    ).toThrow(/PADDLE_WEBHOOK_SECRET/);

    expect(
      parseServerConfig({
        BILLING_PROVIDER: "paddle",
        PADDLE_API_KEY: "paddle_key",
        PADDLE_PRICE_ID: "pri_123",
        PADDLE_WEBHOOK_SECRET: "pdl_whsec",
      }).providers.billing,
    ).toEqual({
      apiKey: "paddle_key",
      environment: "sandbox",
      kind: "paddle",
      priceId: "pri_123",
      webhookSecret: "pdl_whsec",
    });

    expect(
      parseServerConfig({
        BILLING_PROVIDER: "paddle",
        PADDLE_API_KEY: "paddle_key",
        PADDLE_ENVIRONMENT: "production",
        PADDLE_PRICE_ID: "pri_123",
        PADDLE_WEBHOOK_SECRET: "pdl_whsec",
      }).providers.billing,
    ).toMatchObject({ environment: "production", kind: "paddle" });
  });

  it("requires Dodo Payments credentials only when Dodo billing is selected", () => {
    expect(() => parseServerConfig({ BILLING_PROVIDER: "dodo" })).toThrow(/DODO_PAYMENTS_API_KEY/);
    expect(() =>
      parseServerConfig({ BILLING_PROVIDER: "dodo", DODO_PAYMENTS_API_KEY: "dodo_key" }),
    ).toThrow(/DODO_PAYMENTS_WEBHOOK_KEY/);

    expect(
      parseServerConfig({
        BILLING_PROVIDER: "dodo",
        DODO_PAYMENTS_API_KEY: "dodo_key",
        DODO_PAYMENTS_WEBHOOK_KEY: "dodo_whsec",
        DODO_PRODUCT_ID: "pdt_123",
      }).providers.billing,
    ).toEqual({
      apiKey: "dodo_key",
      environment: "test_mode",
      kind: "dodo",
      priceId: "pdt_123",
      webhookSecret: "dodo_whsec",
    });

    expect(
      parseServerConfig({
        BILLING_PROVIDER: "dodo",
        DODO_PAYMENTS_API_KEY: "dodo_key",
        DODO_PAYMENTS_ENVIRONMENT: "live_mode",
        DODO_PAYMENTS_WEBHOOK_KEY: "dodo_whsec",
        DODO_PRODUCT_ID: "pdt_123",
      }).providers.billing,
    ).toMatchObject({ environment: "live_mode", kind: "dodo" });
  });

  it("requires PayPal credentials only when PayPal billing is selected", () => {
    expect(() => parseServerConfig({ BILLING_PROVIDER: "paypal" })).toThrow(/PAYPAL_CLIENT_ID/);
    expect(() =>
      parseServerConfig({
        BILLING_PROVIDER: "paypal",
        PAYPAL_CLIENT_ID: "paypal_cid",
        PAYPAL_CLIENT_SECRET: "paypal_secret",
        PAYPAL_PLAN_ID: "P-123",
      }),
    ).toThrow(/PAYPAL_WEBHOOK_ID/);

    expect(
      parseServerConfig({
        BILLING_PROVIDER: "paypal",
        PAYPAL_CLIENT_ID: "paypal_cid",
        PAYPAL_CLIENT_SECRET: "paypal_secret",
        PAYPAL_PLAN_ID: "P-123",
        PAYPAL_WEBHOOK_ID: "WH-123",
      }).providers.billing,
    ).toEqual({
      clientId: "paypal_cid",
      clientSecret: "paypal_secret",
      environment: "sandbox",
      kind: "paypal",
      priceId: "P-123",
      webhookSecret: "WH-123",
    });

    expect(
      parseServerConfig({
        BILLING_PROVIDER: "paypal",
        PAYPAL_CLIENT_ID: "paypal_cid",
        PAYPAL_CLIENT_SECRET: "paypal_secret",
        PAYPAL_ENVIRONMENT: "live",
        PAYPAL_PLAN_ID: "P-123",
        PAYPAL_WEBHOOK_ID: "WH-123",
      }).providers.billing,
    ).toMatchObject({ environment: "live", kind: "paypal" });
  });

  it("requires each email-sdk provider's credentials only when selected", () => {
    expect(() => parseServerConfig({ EMAIL_PROVIDER: "postmark" })).toThrow(
      /POSTMARK_SERVER_TOKEN/,
    );
    expect(() => parseServerConfig({ EMAIL_PROVIDER: "sendgrid" })).toThrow(/SENDGRID_API_KEY/);
    expect(() => parseServerConfig({ EMAIL_PROVIDER: "mailgun", MAILGUN_API_KEY: "key" })).toThrow(
      /MAILGUN_DOMAIN/,
    );
    expect(() => parseServerConfig({ EMAIL_PROVIDER: "smtp" })).toThrow(/SMTP_HOST/);
    expect(() => parseServerConfig({ EMAIL_PROVIDER: "brevo" })).toThrow(/BREVO_API_KEY/);

    expect(
      parseServerConfig({
        EMAIL_PROVIDER: "mailgun",
        MAILGUN_API_KEY: "key",
        MAILGUN_DOMAIN: "mg.example.test",
        MAILGUN_REGION: "eu",
      }).providers.email,
    ).toEqual({
      apiKey: "key",
      domain: "mg.example.test",
      from: "supastack <hello@example.test>",
      kind: "mailgun",
      region: "eu",
    });

    expect(
      parseServerConfig({
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "smtp.example.test",
        SMTP_USER: "mailer",
        SMTP_PASSWORD: "secret",
      }).providers.email,
    ).toEqual({
      from: "supastack <hello@example.test>",
      host: "smtp.example.test",
      kind: "smtp",
      password: "secret",
      port: 587,
      secure: false,
      user: "mailer",
    });

    // Partial SMTP auth is rejected instead of silently dropping credentials.
    expect(() =>
      parseServerConfig({
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "smtp.example.test",
        SMTP_USER: "mailer",
      }),
    ).toThrow(/SMTP_PASSWORD/);
  });

  it("defaults custom domains off and validates the cloudflare provider", () => {
    expect(parseServerConfig({}).customDomains).toEqual({ kind: "off" });
    expect(parseServerConfig({ CUSTOM_DOMAINS_PROVIDER: "local" }).customDomains).toEqual({
      cnameTarget: "customers.localhost",
      kind: "local",
    });

    expect(() => parseServerConfig({ CUSTOM_DOMAINS_PROVIDER: "cloudflare" })).toThrow(
      /CLOUDFLARE_API_TOKEN/,
    );
    expect(() =>
      parseServerConfig({
        CUSTOM_DOMAINS_PROVIDER: "cloudflare",
        CLOUDFLARE_API_TOKEN: "token",
      }),
    ).toThrow(/CLOUDFLARE_ZONE_ID/);
    expect(() =>
      parseServerConfig({
        CUSTOM_DOMAINS_PROVIDER: "cloudflare",
        CLOUDFLARE_API_TOKEN: "token",
        CLOUDFLARE_ZONE_ID: "zone",
      }),
    ).toThrow(/CUSTOM_DOMAIN_CNAME_TARGET/);

    expect(
      parseServerConfig({
        CUSTOM_DOMAINS_PROVIDER: "cloudflare",
        CLOUDFLARE_API_TOKEN: "token",
        CLOUDFLARE_ZONE_ID: "zone",
        CUSTOM_DOMAIN_CNAME_TARGET: "customers.supastack.dev",
      }).customDomains,
    ).toEqual({
      apiToken: "token",
      cnameTarget: "customers.supastack.dev",
      kind: "cloudflare",
      zoneId: "zone",
    });
  });

  it("defaults the rate-limit store by environment and honors explicit selection", () => {
    expect(parseServerConfig({}).rateLimit.store).toBe("memory");
    expect(parseServerConfig({ NODE_ENV: "test" }).rateLimit.store).toBe("memory");
    expect(parseServerConfig({ NODE_ENV: "production", APP_ENV: "local" }).rateLimit.store).toBe(
      "postgres",
    );
    expect(
      parseServerConfig({ NODE_ENV: "production", APP_ENV: "local", RATE_LIMIT_STORE: "memory" })
        .rateLimit.store,
    ).toBe("memory");
    expect(parseServerConfig({ RATE_LIMIT_STORE: "postgres" }).rateLimit.store).toBe("postgres");
    expect(() => parseServerConfig({ RATE_LIMIT_STORE: "redis" })).toThrow();
  });

  it("defaults to trusting no proxy and bounds configured counts", () => {
    expect(parseServerConfig({}).rateLimit.trustedProxyCount).toBe(0);
    expect(parseServerConfig({ TRUSTED_PROXY_COUNT: "3" }).rateLimit.trustedProxyCount).toBe(3);
    expect(parseServerConfig({ TRUSTED_PROXY_COUNT: "0" }).rateLimit.trustedProxyCount).toBe(0);
    expect(() => parseServerConfig({ TRUSTED_PROXY_COUNT: "11" })).toThrow();
    expect(() => parseServerConfig({ TRUSTED_PROXY_COUNT: "-1" })).toThrow();
    expect(() => parseServerConfig({ TRUSTED_PROXY_COUNT: "many" })).toThrow();
  });

  it("parses the public AI daily budget as a non-negative bigint, defaulting to disabled", () => {
    expect(parseServerConfig({}).publicAi.dailyBudgetMicrounits).toBe(0n);
    expect(
      parseServerConfig({ PUBLIC_AI_DAILY_BUDGET_MICROUNITS: "5000000" }).publicAi
        .dailyBudgetMicrounits,
    ).toBe(5_000_000n);
    expect(() => parseServerConfig({ PUBLIC_AI_DAILY_BUDGET_MICROUNITS: "-5" })).toThrow();
    expect(() => parseServerConfig({ PUBLIC_AI_DAILY_BUDGET_MICROUNITS: "lots" })).toThrow();
  });

  it("requires explicit scheme and mobile origins in production", () => {
    expect(() => parseServerConfig({ APP_ENV: "production" })).toThrow(/EXPO_PUBLIC_APP_SCHEME/);

    expect(
      parseServerConfig({
        APP_ENV: "production",
        APP_URL: "https://app.example.com",
        AUTH_SECRET: "production-auth-secret-at-least-32-characters",
        CREDENTIAL_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        DATABASE_URL: "postgres://supastack:secret@db.example.com:5432/supastack",
        EXPO_PUBLIC_API_URL: "https://api.example.com",
        EXPO_PUBLIC_APP_SCHEME: "com.example.supastack",
        MOBILE_ALLOWED_ORIGINS: "https://app.example.com,https://api.example.com",
      }).mobile,
    ).toEqual({
      allowedOrigins: ["https://app.example.com", "https://api.example.com"],
      scheme: "com.example.supastack",
    });
  });

  it("rejects local fallback secrets and endpoints in production", () => {
    expect(() =>
      parseServerConfig({
        APP_ENV: "production",
        EXPO_PUBLIC_APP_SCHEME: "com.example.supastack",
        MOBILE_ALLOWED_ORIGINS: "https://app.example.com",
      }),
    ).toThrow(/APP_URL/);

    expect(() =>
      parseServerConfig({
        APP_ENV: "production",
        APP_URL: "https://app.example.com",
        AUTH_SECRET: "too-short",
        CREDENTIAL_ENCRYPTION_KEY: "not-a-32-byte-base64-key",
        DATABASE_URL: "postgres://supastack:secret@db.example.com:5432/supastack",
        EXPO_PUBLIC_API_URL: "https://api.example.com",
        EXPO_PUBLIC_APP_SCHEME: "com.example.supastack",
        MOBILE_ALLOWED_ORIGINS: "https://app.example.com",
      }),
    ).toThrow(/AUTH_SECRET/);
  });

  it("rejects malformed production mobile origins", () => {
    expect(() =>
      parseServerConfig({
        APP_ENV: "production",
        EXPO_PUBLIC_APP_SCHEME: "com.example.supastack",
        MOBILE_ALLOWED_ORIGINS: "not-a-url",
      }),
    ).toThrow(/MOBILE_ALLOWED_ORIGINS/);
  });

  it("rejects wildcard production mobile origins", () => {
    expect(() =>
      parseServerConfig({
        APP_ENV: "production",
        EXPO_PUBLIC_APP_SCHEME: "com.example.supastack",
        MOBILE_ALLOWED_ORIGINS: "https://*.example.com",
      }),
    ).toThrow(/wildcard/i);
  });

  it("parses ALERT_WEBHOOK_URL as an optional, server-only webhook URL", () => {
    expect("alertWebhookUrl" in parseServerConfig({}).observability).toBe(false);
    expect("alertWebhookUrl" in parseServerConfig({ ALERT_WEBHOOK_URL: "" }).observability).toBe(
      false,
    );

    const config = parseServerConfig({
      ALERT_WEBHOOK_URL: "https://hooks.example.test/alerts",
    });
    expect(config.observability.alertWebhookUrl).toBe("https://hooks.example.test/alerts");

    expect(() => parseServerConfig({ ALERT_WEBHOOK_URL: "not-a-url" })).toThrow();

    // Server-only: the alert endpoint must never reach the public config.
    expect(JSON.stringify(parsePublicConfig(config))).not.toContain("hooks.example.test");
  });
});

describe("analytics provider configuration", () => {
  it("defaults to off and accepts each provider", () => {
    expect(parseServerConfig({}).providers.analytics).toEqual({ kind: "off" });
    expect(parseServerConfig({ ANALYTICS_PROVIDER: "off" }).providers.analytics).toEqual({
      kind: "off",
    });
    expect(parseServerConfig({ ANALYTICS_PROVIDER: "local" }).providers.analytics).toEqual({
      kind: "local",
    });
    expect(
      parseServerConfig({
        ANALYTICS_PROVIDER: "plausible",
        ANALYTICS_SITE_ID: "example.test",
      }).providers.analytics,
    ).toEqual({ kind: "plausible", siteId: "example.test" });
    expect(
      parseServerConfig({
        ANALYTICS_PROVIDER: "posthog",
        ANALYTICS_SITE_ID: "phc_example",
      }).providers.analytics,
    ).toEqual({ kind: "posthog", siteId: "phc_example" });
    expect(() => parseServerConfig({ ANALYTICS_PROVIDER: "gtm" })).toThrow(/ANALYTICS_PROVIDER/);
  });

  it("requires ANALYTICS_SITE_ID only for the script providers", () => {
    expect(() => parseServerConfig({ ANALYTICS_PROVIDER: "plausible" })).toThrow(
      /ANALYTICS_SITE_ID/,
    );
    expect(() => parseServerConfig({ ANALYTICS_PROVIDER: "posthog" })).toThrow(/ANALYTICS_SITE_ID/);
    expect(() =>
      parseServerConfig({ ANALYTICS_PROVIDER: "posthog", ANALYTICS_SITE_ID: "   " }),
    ).toThrow(/ANALYTICS_SITE_ID/);

    // local collects first-party rows into analytics_event — no external id.
    expect(parseServerConfig({ ANALYTICS_PROVIDER: "local" }).providers.analytics).toEqual({
      kind: "local",
    });
    // off ignores a stray site id entirely.
    expect(
      parseServerConfig({ ANALYTICS_PROVIDER: "off", ANALYTICS_SITE_ID: "ignored" }).providers
        .analytics,
    ).toEqual({ kind: "off" });
  });

  it("accepts an optional https ANALYTICS_HOST for self-hosted script providers", () => {
    expect(
      parseServerConfig({
        ANALYTICS_PROVIDER: "plausible",
        ANALYTICS_SITE_ID: "example.test",
        ANALYTICS_HOST: "https://plausible.example.test",
      }).providers.analytics,
    ).toEqual({
      host: "https://plausible.example.test",
      kind: "plausible",
      siteId: "example.test",
    });
    expect(
      parseServerConfig({
        ANALYTICS_PROVIDER: "posthog",
        ANALYTICS_SITE_ID: "phc_example",
        ANALYTICS_HOST: "https://eu.i.posthog.com",
      }).providers.analytics,
    ).toEqual({
      host: "https://eu.i.posthog.com",
      kind: "posthog",
      siteId: "phc_example",
    });
  });

  it("strips trailing slashes from ANALYTICS_HOST", () => {
    expect(
      parseServerConfig({
        ANALYTICS_PROVIDER: "plausible",
        ANALYTICS_SITE_ID: "example.test",
        ANALYTICS_HOST: "https://plausible.example.test/",
      }).providers.analytics,
    ).toEqual({
      host: "https://plausible.example.test",
      kind: "plausible",
      siteId: "example.test",
    });
    expect(
      parseServerConfig({
        ANALYTICS_PROVIDER: "posthog",
        ANALYTICS_SITE_ID: "phc_example",
        ANALYTICS_HOST: "https://eu.i.posthog.com///",
      }).providers.analytics,
    ).toEqual({
      host: "https://eu.i.posthog.com",
      kind: "posthog",
      siteId: "phc_example",
    });
  });

  it("rejects a non-https ANALYTICS_HOST and treats blank as unset", () => {
    expect(() => parseServerConfig({ ANALYTICS_HOST: "http://analytics.example.test" })).toThrow(
      /ANALYTICS_HOST/,
    );
    expect(() => parseServerConfig({ ANALYTICS_HOST: "not-a-url" })).toThrow();
    expect(parseServerConfig({ ANALYTICS_HOST: "" }).providers.analytics).toEqual({
      kind: "off",
    });
  });

  it("exposes the provider kind (never the site id or host) in the public config", () => {
    expect(parsePublicConfig(parseServerConfig({})).providers.analytics).toBe("off");
    expect(
      parsePublicConfig(
        parseServerConfig({
          ANALYTICS_PROVIDER: "plausible",
          ANALYTICS_SITE_ID: "example.test",
        }),
      ).providers.analytics,
    ).toBe("plausible");
  });
});

describe("parsePublicConfig", () => {
  it("exposes only client-safe configuration", () => {
    const publicConfig = parsePublicConfig(
      parseServerConfig({
        AUTH_SECRET: "server-only-auth-secret",
        DATABASE_URL: "postgres://user:password@localhost:5432/supastack",
        OPENAI_API_KEY: "server-only-openai-key",
      }),
    );

    expect(publicConfig).toMatchObject({
      app: { environment: "local", webUrl: "http://localhost:3000" },
      auth: {
        providers: {
          apple: false,
          emailOtp: true,
          github: false,
          google: false,
          microsoft: false,
          password: true,
          twitter: false,
        },
      },
      providers: {
        ai: "fake",
        analytics: "off",
        billing: "local",
        customDomains: "off",
        email: "local",
        jobs: "local",
        storage: "memory",
      },
    });
    expect(JSON.stringify(publicConfig)).not.toContain("server-only-auth-secret");
    expect(JSON.stringify(publicConfig)).not.toContain("postgres://user:password");
    expect(JSON.stringify(publicConfig)).not.toContain("server-only-openai-key");
  });

  it("requires Turnstile keys only when CAPTCHA_PROVIDER is turnstile", () => {
    expect(() => parseServerConfig({ CAPTCHA_PROVIDER: "turnstile" })).toThrow(
      /TURNSTILE_SECRET_KEY/,
    );
    expect(() =>
      parseServerConfig({
        CAPTCHA_PROVIDER: "turnstile",
        TURNSTILE_SECRET_KEY: "turnstile-secret",
      }),
    ).toThrow(/NEXT_PUBLIC_TURNSTILE_SITE_KEY/);

    const config = parseServerConfig({
      CAPTCHA_PROVIDER: "turnstile",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key",
    });
    expect(config.providers.captcha).toEqual({
      kind: "turnstile",
      secretKey: "turnstile-secret",
      siteKey: "turnstile-site-key",
    });

    const publicConfig = parsePublicConfig(config);
    expect(publicConfig.captcha).toEqual({
      provider: "turnstile",
      turnstileSiteKey: "turnstile-site-key",
    });
    expect(JSON.stringify(publicConfig)).not.toContain("turnstile-secret");
  });

  it("requires storage credentials only when S3 is selected", () => {
    expect(() => parseServerConfig({ STORAGE_PROVIDER: "s3" })).toThrow(/STORAGE_BUCKET/);
    expect(
      parseServerConfig({
        STORAGE_PROVIDER: "s3",
        STORAGE_BUCKET: "kit",
        STORAGE_ACCESS_KEY_ID: "ak",
        STORAGE_SECRET_ACCESS_KEY: "sk",
        STORAGE_PUBLIC_BASE_URL: "https://cdn.example.test",
      }).providers.storage,
    ).toMatchObject({ kind: "s3", bucket: "kit" });
  });

  it("defaults S3 region and derives forcePathStyle from the endpoint", () => {
    const base = {
      STORAGE_PROVIDER: "s3",
      STORAGE_BUCKET: "kit",
      STORAGE_ACCESS_KEY_ID: "ak",
      STORAGE_SECRET_ACCESS_KEY: "sk",
    } as const;

    // AWS-style config (no custom endpoint): virtual-hosted addressing.
    expect(parseServerConfig(base).providers.storage).toMatchObject({
      forcePathStyle: false,
      region: "us-east-1",
    });
    // Supabase/MinIO custom endpoint: path-style addressing by default.
    expect(
      parseServerConfig({
        ...base,
        STORAGE_ENDPOINT: "https://project.supabase.co/storage/v1/s3",
        STORAGE_REGION: "eu-west-1",
      }).providers.storage,
    ).toMatchObject({ forcePathStyle: true, region: "eu-west-1" });
    // Explicit override wins both ways.
    expect(
      parseServerConfig({
        ...base,
        STORAGE_ENDPOINT: "https://s3-compatible.example.test",
        STORAGE_FORCE_PATH_STYLE: "false",
      }).providers.storage,
    ).toMatchObject({ forcePathStyle: false });
    expect(
      parseServerConfig({ ...base, STORAGE_FORCE_PATH_STYLE: "true" }).providers.storage,
    ).toMatchObject({ forcePathStyle: true });
  });

  it("parses ADMIN_EMAILS into a deduped, lowercased, server-only list", () => {
    const config = parseServerConfig({
      ADMIN_EMAILS: " Root@Example.test , ops@example.test,root@example.test ",
    });

    expect(config.admin.emails).toEqual(["root@example.test", "ops@example.test"]);
    expect(JSON.stringify(parsePublicConfig(config))).not.toContain("root@example.test");
    expect(JSON.stringify(parsePublicConfig(config))).not.toContain("ops@example.test");
  });

  it("defaults early-access invite-only off and parses the flag", () => {
    expect(parseServerConfig({}).earlyAccess.inviteOnly).toBe(false);
    expect(parseServerConfig({ EARLY_ACCESS_INVITE_ONLY: "true" }).earlyAccess.inviteOnly).toBe(
      true,
    );
    // Server-only: the gate flag must not leak into the public config.
    expect(
      JSON.stringify(parsePublicConfig(parseServerConfig({ EARLY_ACCESS_INVITE_ONLY: "true" }))),
    ).not.toContain("inviteOnly");
  });

  it("disables every connected-account provider when no client ids are set", () => {
    const config = parseServerConfig({});

    expect(config.connectedAccounts).toEqual({
      google: { enabled: false },
      microsoft: { enabled: false },
      x: { enabled: false },
    });
  });

  it("enables X on client id alone; google/microsoft stay disabled without a secret", () => {
    const publicClient = parseServerConfig({ CONNECTED_X_CLIENT_ID: "x-id" });
    expect(publicClient.connectedAccounts.x).toEqual({ clientId: "x-id", enabled: true });
    expect("clientSecret" in publicClient.connectedAccounts.x).toBe(false);

    // Only X supports public PKCE-only clients — a Google/Microsoft client id
    // without its secret must not half-enable the connect flow.
    const idOnly = parseServerConfig({
      CONNECTED_GOOGLE_CLIENT_ID: "g-id",
      CONNECTED_MICROSOFT_CLIENT_ID: "m-id",
    });
    expect(idOnly.connectedAccounts.google).toEqual({ enabled: false });
    expect(idOnly.connectedAccounts.microsoft).toEqual({ enabled: false });

    const confidential = parseServerConfig({
      CONNECTED_GOOGLE_CLIENT_ID: "g-id",
      CONNECTED_GOOGLE_CLIENT_SECRET: "g-secret",
      CONNECTED_MICROSOFT_CLIENT_ID: "m-id",
      CONNECTED_MICROSOFT_CLIENT_SECRET: "m-secret",
    });
    expect(confidential.connectedAccounts.google).toEqual({
      clientId: "g-id",
      clientSecret: "g-secret",
      enabled: true,
    });
    expect(confidential.connectedAccounts.microsoft).toEqual({
      clientId: "m-id",
      clientSecret: "m-secret",
      enabled: true,
    });
    // Server-only: secrets must never reach the public config payload.
    expect(JSON.stringify(parsePublicConfig(confidential))).not.toContain("g-secret");
    expect(JSON.stringify(parsePublicConfig(confidential))).not.toContain("m-secret");
  });

  it("parses SCHEDULER_TICK_SECRET as an optional server-only value", () => {
    expect(parseServerConfig({}).scheduler.tickSecret).toBeUndefined();
    expect(parseServerConfig({ SCHEDULER_TICK_SECRET: "tick-secret" }).scheduler.tickSecret).toBe(
      "tick-secret",
    );
    expect(
      JSON.stringify(
        parsePublicConfig(parseServerConfig({ SCHEDULER_TICK_SECRET: "tick-secret" })),
      ),
    ).not.toContain("tick-secret");
  });

  it("parses EXPO_ACCESS_TOKEN as an optional server-only push credential", () => {
    expect(parseServerConfig({}).expo.accessToken).toBeUndefined();
    expect(parseServerConfig({ EXPO_ACCESS_TOKEN: "" }).expo.accessToken).toBeUndefined();
    expect(parseServerConfig({ EXPO_ACCESS_TOKEN: "expo-push-token" }).expo.accessToken).toBe(
      "expo-push-token",
    );
    // Server-only: the Expo credential must never reach the public config.
    expect(
      JSON.stringify(
        parsePublicConfig(parseServerConfig({ EXPO_ACCESS_TOKEN: "expo-push-token" })),
      ),
    ).not.toContain("expo-push-token");
  });
});
