import { z } from "zod";

const aliasModelIds = z
  .array(z.string().trim().min(1).max(255))
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, "Model IDs must be unique within an alias.");
const aiRoutingPolicySchema = z
  .object({ fast: aliasModelIds, smart: aliasModelIds, cheap: aliasModelIds })
  .strict();
export type AiRoutingPolicy = z.infer<typeof aiRoutingPolicySchema>;
const aiRoutingEnvironment = z
  .string()
  .max(100_000)
  .transform((value, context) => {
    try {
      const parsed = aiRoutingPolicySchema.safeParse(JSON.parse(value) as unknown);
      if (parsed.success) return parsed.data;
    } catch {
      /* Report a generic error, never the supplied configuration. */
    }
    context.addIssue({
      code: "custom",
      message: "AI_MODEL_POLICY must contain unique model ID arrays for fast, smart and cheap.",
    });
    return z.NEVER;
  })
  .optional();

const appEnvironments = ["local", "development", "test", "production"] as const;
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);
const environmentBoolean = optionalText
  .pipe(z.enum(["true", "false"]).optional())
  .transform((value) => value === "true");
const optionalUrl = optionalText.pipe(z.string().url().optional());
const optionalHttpsUrl = optionalText
  .pipe(z.string().url().optional())
  .refine((value) => value === undefined || value.startsWith("https://"), {
    message: "must be an https URL.",
  });

function isExactProductionOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1" &&
      url.hostname !== "[::1]" &&
      !url.hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

function isThirtyTwoByteBase64(value: string): boolean {
  return /^[A-Za-z0-9+/]{43}=$/.test(value) && Buffer.from(value, "base64").byteLength === 32;
}

const rawServerConfigSchema = z
  .object({
    ADMIN_EMAILS: optionalText,
    AGENT_FRAMEWORK: z
      .enum(["ai-sdk", "mastra", "langgraph", "openai-agents"])
      .optional()
      .transform((value) => value ?? "ai-sdk"),
    AI_MODEL_POLICY: aiRoutingEnvironment,
    AI_PROVIDER: z
      .enum(["fake", "openai", "anthropic", "openai-compatible", "openrouter"])
      .optional()
      .transform((value) => value ?? "fake"),
    // Trailing slashes are stripped so `${host}/js/script.js` never doubles.
    ANALYTICS_HOST: optionalHttpsUrl.transform((value) => value?.replace(/\/+$/, "")),
    ANALYTICS_PROVIDER: z
      .enum(["off", "local", "plausible", "posthog"])
      .optional()
      .transform((value) => value ?? "off"),
    ANALYTICS_SITE_ID: optionalText,
    ANTHROPIC_API_KEY: optionalText,
    APP_ENV: z
      .enum(appEnvironments)
      .optional()
      .transform((value) => value ?? "local"),
    APP_URL: optionalText,
    APPLE_CLIENT_ID: optionalText,
    APPLE_CLIENT_SECRET: optionalText,
    AUTH_APPLE_ENABLED: environmentBoolean,
    AUTH_GITHUB_ENABLED: environmentBoolean,
    AUTH_GOOGLE_ENABLED: environmentBoolean,
    AUTH_MICROSOFT_ENABLED: environmentBoolean,
    AUTH_PROVIDER: z
      .enum(["better-auth", "authjs"])
      .optional()
      .transform((value) => value ?? "better-auth"),
    AUTH_SECRET: optionalText,
    AUTH_TWITTER_ENABLED: environmentBoolean,
    AWS_ACCESS_KEY_ID: optionalText,
    AWS_REGION: optionalText,
    AWS_SECRET_ACCESS_KEY: optionalText,
    AWS_SESSION_TOKEN: optionalText,
    BREVO_API_KEY: optionalText,
    BILLING_PROVIDER: z
      .enum([
        "local",
        "stripe",
        "lemonsqueezy",
        "creem",
        "polar",
        "whop",
        "paddle",
        "dodo",
        "paypal",
      ])
      .optional()
      .transform((value) => value ?? "local"),
    CAPTCHA_PROVIDER: z
      .enum(["off", "turnstile"])
      .optional()
      .transform((value) => value ?? "off"),
    CLOUDFLARE_API_TOKEN: optionalText,
    CLOUDFLARE_ZONE_ID: optionalText,
    CONNECTED_GOOGLE_CLIENT_ID: optionalText,
    CONNECTED_GOOGLE_CLIENT_SECRET: optionalText,
    CONNECTED_MICROSOFT_CLIENT_ID: optionalText,
    CONNECTED_MICROSOFT_CLIENT_SECRET: optionalText,
    CONNECTED_X_CLIENT_ID: optionalText,
    CONNECTED_X_CLIENT_SECRET: optionalText,
    CREEM_API_KEY: optionalText,
    CREEM_PRODUCT_ID: optionalText,
    CREEM_TEST_MODE: environmentBoolean,
    CREEM_WEBHOOK_SECRET: optionalText,
    CREDENTIAL_ENCRYPTION_KEY: optionalText,
    CUSTOM_DOMAINS_PROVIDER: z
      .enum(["off", "local", "cloudflare"])
      .optional()
      .transform((value) => value ?? "off"),
    CUSTOM_DOMAIN_CNAME_TARGET: optionalText,
    DATABASE_URL: optionalText,
    DODO_PAYMENTS_API_KEY: optionalText,
    DODO_PAYMENTS_ENVIRONMENT: z
      .enum(["test_mode", "live_mode"])
      .optional()
      .transform((value) => value ?? "test_mode"),
    DODO_PAYMENTS_WEBHOOK_KEY: optionalText,
    DODO_PRODUCT_ID: optionalText,
    DODO_PRODUCT_ID_LIFETIME: optionalText,
    DODO_PRODUCT_ID_PRO: optionalText,
    DODO_PRODUCT_ID_PRO_YEARLY: optionalText,
    EARLY_ACCESS_INVITE_ONLY: environmentBoolean,
    EMAIL_FROM: optionalText,
    EMAIL_PROVIDER: z
      .enum(["local", "resend", "ses", "postmark", "sendgrid", "mailgun", "smtp", "brevo"])
      .optional()
      .transform((value) => value ?? "local"),
    EXPO_ACCESS_TOKEN: optionalText,
    EXPO_PUBLIC_API_URL: optionalText,
    EXPO_PUBLIC_APP_SCHEME: optionalText,
    GITHUB_CLIENT_ID: optionalText,
    GITHUB_CLIENT_SECRET: optionalText,
    GOOGLE_CLIENT_ID: optionalText,
    GOOGLE_CLIENT_SECRET: optionalText,
    JOB_PROVIDER: z
      .enum(["local", "trigger"])
      .optional()
      .transform((value) => value ?? "local"),
    LEMONSQUEEZY_API_KEY: optionalText,
    LEMONSQUEEZY_STORE_ID: optionalText,
    LEMONSQUEEZY_VARIANT_ID: optionalText,
    LEMONSQUEEZY_WEBHOOK_SECRET: optionalText,
    MAILGUN_API_KEY: optionalText,
    MAILGUN_DOMAIN: optionalText,
    MAILGUN_REGION: optionalText
      .pipe(z.enum(["us", "eu"]).optional())
      .transform((value) => value ?? "us"),
    MICROSOFT_CLIENT_ID: optionalText,
    MICROSOFT_CLIENT_SECRET: optionalText,
    MOBILE_ALLOWED_ORIGINS: optionalText,
    MOBILE_PURCHASES_PROVIDER: z.enum(["off", "revenuecat"]).default("off"),
    REVENUECAT_SECRET_API_KEY: optionalText,
    REVENUECAT_WEBHOOK_AUTHORIZATION: optionalText,
    REVENUECAT_ENTITLEMENT_ID: z.string().trim().min(1).max(100).default("pro"),
    REVENUECAT_ENTITLEMENT_KEY: z.string().trim().min(1).max(100).default("ai.reference-task"),
    REVENUECAT_ALLOW_SANDBOX: optionalText.pipe(z.enum(["true", "false"]).optional()),
    NEXT_PUBLIC_POSTHOG_HOST: optionalText,
    NEXT_PUBLIC_POSTHOG_KEY: optionalText,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalText,
    NODE_ENV: optionalText,
    PADDLE_API_KEY: optionalText,
    PADDLE_ENVIRONMENT: z
      .enum(["sandbox", "production"])
      .optional()
      .transform((value) => value ?? "sandbox"),
    PADDLE_PRICE_ID: optionalText,
    PADDLE_PRICE_ID_LIFETIME: optionalText,
    PADDLE_PRICE_ID_PRO: optionalText,
    PADDLE_PRICE_ID_PRO_YEARLY: optionalText,
    PADDLE_WEBHOOK_SECRET: optionalText,
    PAYPAL_CLIENT_ID: optionalText,
    PAYPAL_CLIENT_SECRET: optionalText,
    PAYPAL_ENVIRONMENT: z
      .enum(["sandbox", "live"])
      .optional()
      .transform((value) => value ?? "sandbox"),
    PAYPAL_PLAN_ID: optionalText,
    PAYPAL_PLAN_ID_LIFETIME: optionalText,
    PAYPAL_PLAN_ID_PRO: optionalText,
    PAYPAL_PLAN_ID_PRO_YEARLY: optionalText,
    PAYPAL_WEBHOOK_ID: optionalText,
    POLAR_ACCESS_TOKEN: optionalText,
    POLAR_PRODUCT_ID: optionalText,
    POLAR_PRODUCT_ID_LIFETIME: optionalText,
    POLAR_PRODUCT_ID_PRO: optionalText,
    POLAR_PRODUCT_ID_PRO_YEARLY: optionalText,
    POLAR_SERVER: z
      .enum(["sandbox", "production"])
      .optional()
      .transform((value) => value ?? "sandbox"),
    POLAR_WEBHOOK_SECRET: optionalText,
    PUBLIC_AI_DAILY_BUDGET_MICROUNITS: z
      .string()
      .trim()
      .regex(/^[0-9]+$/)
      .transform((value) => BigInt(value))
      .optional(),
    RATE_LIMIT_STORE: z.enum(["memory", "postgres"]).optional(),
    OPENAI_API_KEY: optionalText,
    OPENAI_COMPATIBLE_API_KEY: optionalText,
    OPENAI_COMPATIBLE_BASE_URL: optionalText,
    OPENROUTER_API_KEY: optionalText,
    OPENROUTER_APP_NAME: optionalText,
    OPENROUTER_SITE_URL: optionalText,
    POSTMARK_SERVER_TOKEN: optionalText,
    RESEND_API_KEY: optionalText,
    SCHEDULER_TICK_SECRET: optionalText,
    SENDGRID_API_KEY: optionalText,
    ALERT_WEBHOOK_URL: optionalUrl,
    SENTRY_DSN: optionalText,
    SMTP_HOST: optionalText,
    SMTP_PASSWORD: optionalText,
    SMTP_PORT: z
      .string()
      .trim()
      .regex(/^[0-9]{1,5}$/)
      .transform((value) => Number(value))
      .pipe(z.number().int().min(1).max(65535))
      .optional(),
    SMTP_SECURE: environmentBoolean,
    SMTP_USER: optionalText,
    STORAGE_BUCKET: optionalText,
    STORAGE_ENDPOINT: optionalText,
    STORAGE_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
    STORAGE_PUBLIC_BASE_URL: optionalText,
    STORAGE_REGION: optionalText,
    STORAGE_PROVIDER: z
      .enum(["memory", "s3"])
      .optional()
      .transform((value) => value ?? "memory"),
    STORAGE_ACCESS_KEY_ID: optionalText,
    STORAGE_SECRET_ACCESS_KEY: optionalText,
    STRIPE_PRICE_ID: optionalText,
    STRIPE_SECRET_KEY: optionalText,
    STRIPE_WEBHOOK_SECRET: optionalText,
    TRIGGER_PROJECT_REF: optionalText,
    TRIGGER_SECRET_KEY: optionalText,
    TRUSTED_PROXY_COUNT: z
      .string()
      .trim()
      .regex(/^[0-9]{1,2}$/)
      .transform((value) => Number(value))
      .pipe(z.number().int().min(0).max(10))
      .optional(),
    TURNSTILE_SECRET_KEY: optionalText,
    WHOP_API_KEY: optionalText,
    WHOP_PLAN_ID: optionalText,
    WHOP_PLAN_ID_LIFETIME: optionalText,
    WHOP_PLAN_ID_PRO: optionalText,
    WHOP_PLAN_ID_PRO_YEARLY: optionalText,
    WHOP_WEBHOOK_SECRET: optionalText,
    TWITTER_CLIENT_ID: optionalText,
    TWITTER_CLIENT_SECRET: optionalText,
  })
  .superRefine((environment, context) => {
    const requireValue = (name: string, value: string | undefined, reason: string): void => {
      if (!value) {
        context.addIssue({
          code: "custom",
          message: `${name} is required when ${reason}.`,
          path: [name],
        });
      }
    };
    const requireOAuthCredentials = (
      enabled: boolean,
      clientIdName: string,
      clientId: string | undefined,
      clientSecretName: string,
      clientSecret: string | undefined,
      providerName: string,
    ): void => {
      if (enabled) {
        requireValue(clientIdName, clientId, `${providerName} auth is enabled`);
        requireValue(clientSecretName, clientSecret, `${providerName} auth is enabled`);
      }
    };

    requireOAuthCredentials(
      environment.AUTH_GOOGLE_ENABLED,
      "GOOGLE_CLIENT_ID",
      environment.GOOGLE_CLIENT_ID,
      "GOOGLE_CLIENT_SECRET",
      environment.GOOGLE_CLIENT_SECRET,
      "Google",
    );
    requireOAuthCredentials(
      environment.AUTH_APPLE_ENABLED,
      "APPLE_CLIENT_ID",
      environment.APPLE_CLIENT_ID,
      "APPLE_CLIENT_SECRET",
      environment.APPLE_CLIENT_SECRET,
      "Apple",
    );
    requireOAuthCredentials(
      environment.AUTH_GITHUB_ENABLED,
      "GITHUB_CLIENT_ID",
      environment.GITHUB_CLIENT_ID,
      "GITHUB_CLIENT_SECRET",
      environment.GITHUB_CLIENT_SECRET,
      "GitHub",
    );
    requireOAuthCredentials(
      environment.AUTH_TWITTER_ENABLED,
      "TWITTER_CLIENT_ID",
      environment.TWITTER_CLIENT_ID,
      "TWITTER_CLIENT_SECRET",
      environment.TWITTER_CLIENT_SECRET,
      "Twitter",
    );
    requireOAuthCredentials(
      environment.AUTH_MICROSOFT_ENABLED,
      "MICROSOFT_CLIENT_ID",
      environment.MICROSOFT_CLIENT_ID,
      "MICROSOFT_CLIENT_SECRET",
      environment.MICROSOFT_CLIENT_SECRET,
      "Microsoft",
    );

    if (environment.MOBILE_PURCHASES_PROVIDER === "revenuecat") {
      requireValue(
        "REVENUECAT_SECRET_API_KEY",
        environment.REVENUECAT_SECRET_API_KEY,
        "MOBILE_PURCHASES_PROVIDER is revenuecat",
      );
      requireValue(
        "REVENUECAT_WEBHOOK_AUTHORIZATION",
        environment.REVENUECAT_WEBHOOK_AUTHORIZATION,
        "MOBILE_PURCHASES_PROVIDER is revenuecat",
      );
      if (environment.APP_ENV === "production" && environment.REVENUECAT_ALLOW_SANDBOX === "true") {
        context.addIssue({
          code: "custom",
          message: "Sandbox purchases cannot grant production access.",
          path: ["REVENUECAT_ALLOW_SANDBOX"],
        });
      }
    }
    if (environment.AI_PROVIDER === "openai") {
      requireValue("OPENAI_API_KEY", environment.OPENAI_API_KEY, "AI_PROVIDER is openai");
    }
    if (environment.AI_PROVIDER === "anthropic") {
      requireValue("ANTHROPIC_API_KEY", environment.ANTHROPIC_API_KEY, "AI_PROVIDER is anthropic");
    }
    if (environment.AI_PROVIDER === "openai-compatible") {
      requireValue(
        "OPENAI_COMPATIBLE_API_KEY",
        environment.OPENAI_COMPATIBLE_API_KEY,
        "AI_PROVIDER is openai-compatible",
      );
      requireValue(
        "OPENAI_COMPATIBLE_BASE_URL",
        environment.OPENAI_COMPATIBLE_BASE_URL,
        "AI_PROVIDER is openai-compatible",
      );
    }
    if (environment.AI_PROVIDER === "openrouter") {
      requireValue(
        "OPENROUTER_API_KEY",
        environment.OPENROUTER_API_KEY,
        "AI_PROVIDER is openrouter",
      );
    }
    if (environment.EMAIL_PROVIDER === "resend") {
      requireValue("RESEND_API_KEY", environment.RESEND_API_KEY, "EMAIL_PROVIDER is resend");
    }
    if (environment.CAPTCHA_PROVIDER === "turnstile") {
      requireValue(
        "TURNSTILE_SECRET_KEY",
        environment.TURNSTILE_SECRET_KEY,
        "CAPTCHA_PROVIDER is turnstile",
      );
      requireValue(
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
        environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        "CAPTCHA_PROVIDER is turnstile",
      );
    }
    if (
      environment.ANALYTICS_PROVIDER === "plausible" ||
      environment.ANALYTICS_PROVIDER === "posthog"
    ) {
      requireValue(
        "ANALYTICS_SITE_ID",
        environment.ANALYTICS_SITE_ID,
        `ANALYTICS_PROVIDER is ${environment.ANALYTICS_PROVIDER}`,
      );
    }
    // With no explicit keys, the Node SDK resolves an IAM role or local AWS profile.
    if (
      environment.EMAIL_PROVIDER === "ses" &&
      (environment.AWS_ACCESS_KEY_ID ||
        environment.AWS_SECRET_ACCESS_KEY ||
        environment.AWS_SESSION_TOKEN)
    ) {
      requireValue("AWS_ACCESS_KEY_ID", environment.AWS_ACCESS_KEY_ID, "EMAIL_PROVIDER is ses");
      requireValue(
        "AWS_SECRET_ACCESS_KEY",
        environment.AWS_SECRET_ACCESS_KEY,
        "EMAIL_PROVIDER is ses",
      );
    }
    if (environment.EMAIL_PROVIDER === "postmark") {
      requireValue(
        "POSTMARK_SERVER_TOKEN",
        environment.POSTMARK_SERVER_TOKEN,
        "EMAIL_PROVIDER is postmark",
      );
    }
    if (environment.EMAIL_PROVIDER === "sendgrid") {
      requireValue("SENDGRID_API_KEY", environment.SENDGRID_API_KEY, "EMAIL_PROVIDER is sendgrid");
    }
    if (environment.EMAIL_PROVIDER === "mailgun") {
      requireValue("MAILGUN_API_KEY", environment.MAILGUN_API_KEY, "EMAIL_PROVIDER is mailgun");
      requireValue("MAILGUN_DOMAIN", environment.MAILGUN_DOMAIN, "EMAIL_PROVIDER is mailgun");
    }
    if (environment.EMAIL_PROVIDER === "smtp") {
      requireValue("SMTP_HOST", environment.SMTP_HOST, "EMAIL_PROVIDER is smtp");
      if (environment.SMTP_USER !== undefined || environment.SMTP_PASSWORD !== undefined) {
        requireValue("SMTP_USER", environment.SMTP_USER, "SMTP authentication is configured");
        requireValue(
          "SMTP_PASSWORD",
          environment.SMTP_PASSWORD,
          "SMTP authentication is configured",
        );
      }
    }
    if (environment.EMAIL_PROVIDER === "brevo") {
      requireValue("BREVO_API_KEY", environment.BREVO_API_KEY, "EMAIL_PROVIDER is brevo");
    }
    if (environment.CUSTOM_DOMAINS_PROVIDER === "cloudflare") {
      requireValue(
        "CLOUDFLARE_API_TOKEN",
        environment.CLOUDFLARE_API_TOKEN,
        "CUSTOM_DOMAINS_PROVIDER is cloudflare",
      );
      requireValue(
        "CLOUDFLARE_ZONE_ID",
        environment.CLOUDFLARE_ZONE_ID,
        "CUSTOM_DOMAINS_PROVIDER is cloudflare",
      );
      requireValue(
        "CUSTOM_DOMAIN_CNAME_TARGET",
        environment.CUSTOM_DOMAIN_CNAME_TARGET,
        "CUSTOM_DOMAINS_PROVIDER is cloudflare",
      );
    }
    if (environment.BILLING_PROVIDER === "stripe") {
      requireValue(
        "STRIPE_SECRET_KEY",
        environment.STRIPE_SECRET_KEY,
        "BILLING_PROVIDER is stripe",
      );
      requireValue(
        "STRIPE_WEBHOOK_SECRET",
        environment.STRIPE_WEBHOOK_SECRET,
        "BILLING_PROVIDER is stripe",
      );
      requireValue("STRIPE_PRICE_ID", environment.STRIPE_PRICE_ID, "BILLING_PROVIDER is stripe");
    }
    if (environment.BILLING_PROVIDER === "lemonsqueezy") {
      for (const name of [
        "LEMONSQUEEZY_API_KEY",
        "LEMONSQUEEZY_STORE_ID",
        "LEMONSQUEEZY_VARIANT_ID",
        "LEMONSQUEEZY_WEBHOOK_SECRET",
      ] as const) {
        requireValue(name, environment[name], "BILLING_PROVIDER is lemonsqueezy");
      }
    }
    if (environment.BILLING_PROVIDER === "creem") {
      for (const name of ["CREEM_API_KEY", "CREEM_PRODUCT_ID", "CREEM_WEBHOOK_SECRET"] as const) {
        requireValue(name, environment[name], "BILLING_PROVIDER is creem");
      }
    }
    if (environment.BILLING_PROVIDER === "polar") {
      for (const name of [
        "POLAR_ACCESS_TOKEN",
        "POLAR_PRODUCT_ID",
        "POLAR_WEBHOOK_SECRET",
      ] as const) {
        requireValue(name, environment[name], "BILLING_PROVIDER is polar");
      }
    }
    if (environment.BILLING_PROVIDER === "whop") {
      for (const name of ["WHOP_API_KEY", "WHOP_PLAN_ID", "WHOP_WEBHOOK_SECRET"] as const) {
        requireValue(name, environment[name], "BILLING_PROVIDER is whop");
      }
    }
    if (environment.BILLING_PROVIDER === "paddle") {
      for (const name of ["PADDLE_API_KEY", "PADDLE_PRICE_ID", "PADDLE_WEBHOOK_SECRET"] as const) {
        requireValue(name, environment[name], "BILLING_PROVIDER is paddle");
      }
    }
    if (environment.BILLING_PROVIDER === "dodo") {
      for (const name of [
        "DODO_PAYMENTS_API_KEY",
        "DODO_PRODUCT_ID",
        "DODO_PAYMENTS_WEBHOOK_KEY",
      ] as const) {
        requireValue(name, environment[name], "BILLING_PROVIDER is dodo");
      }
    }
    if (environment.BILLING_PROVIDER === "paypal") {
      for (const name of [
        "PAYPAL_CLIENT_ID",
        "PAYPAL_CLIENT_SECRET",
        "PAYPAL_PLAN_ID",
        "PAYPAL_WEBHOOK_ID",
      ] as const) {
        requireValue(name, environment[name], "BILLING_PROVIDER is paypal");
      }
    }
    if (environment.JOB_PROVIDER === "trigger") {
      requireValue("TRIGGER_SECRET_KEY", environment.TRIGGER_SECRET_KEY, "JOB_PROVIDER is trigger");
      requireValue(
        "TRIGGER_PROJECT_REF",
        environment.TRIGGER_PROJECT_REF,
        "JOB_PROVIDER is trigger",
      );
    }
    if (environment.STORAGE_PROVIDER === "s3") {
      requireValue("STORAGE_BUCKET", environment.STORAGE_BUCKET, "STORAGE_PROVIDER is s3");
      requireValue(
        "STORAGE_ACCESS_KEY_ID",
        environment.STORAGE_ACCESS_KEY_ID,
        "STORAGE_PROVIDER is s3",
      );
      requireValue(
        "STORAGE_SECRET_ACCESS_KEY",
        environment.STORAGE_SECRET_ACCESS_KEY,
        "STORAGE_PROVIDER is s3",
      );
    }
    if (environment.APP_ENV === "production") {
      requireValue("APP_URL", environment.APP_URL, "APP_ENV is production");
      requireValue("EXPO_PUBLIC_API_URL", environment.EXPO_PUBLIC_API_URL, "APP_ENV is production");
      requireValue("AUTH_SECRET", environment.AUTH_SECRET, "APP_ENV is production");
      requireValue(
        "CREDENTIAL_ENCRYPTION_KEY",
        environment.CREDENTIAL_ENCRYPTION_KEY,
        "APP_ENV is production",
      );
      requireValue("DATABASE_URL", environment.DATABASE_URL, "APP_ENV is production");
      requireValue(
        "EXPO_PUBLIC_APP_SCHEME",
        environment.EXPO_PUBLIC_APP_SCHEME,
        "APP_ENV is production",
      );
      requireValue(
        "MOBILE_ALLOWED_ORIGINS",
        environment.MOBILE_ALLOWED_ORIGINS,
        "APP_ENV is production",
      );

      if (environment.APP_URL && !isExactProductionOrigin(environment.APP_URL)) {
        context.addIssue({
          code: "custom",
          message: "APP_URL must be an exact, non-local HTTPS origin in production.",
          path: ["APP_URL"],
        });
      }
      if (
        environment.EXPO_PUBLIC_API_URL &&
        !isExactProductionOrigin(environment.EXPO_PUBLIC_API_URL)
      ) {
        context.addIssue({
          code: "custom",
          message: "EXPO_PUBLIC_API_URL must be an exact, non-local HTTPS origin in production.",
          path: ["EXPO_PUBLIC_API_URL"],
        });
      }
      if (environment.AUTH_SECRET && environment.AUTH_SECRET.length < 32) {
        context.addIssue({
          code: "custom",
          message: "AUTH_SECRET must contain at least 32 characters in production.",
          path: ["AUTH_SECRET"],
        });
      }
      if (
        environment.CREDENTIAL_ENCRYPTION_KEY &&
        !isThirtyTwoByteBase64(environment.CREDENTIAL_ENCRYPTION_KEY)
      ) {
        context.addIssue({
          code: "custom",
          message: "CREDENTIAL_ENCRYPTION_KEY must be a Base64-encoded 32-byte key in production.",
          path: ["CREDENTIAL_ENCRYPTION_KEY"],
        });
      }
    }

    if (
      environment.EXPO_PUBLIC_APP_SCHEME &&
      !/^[a-z][a-z0-9+.-]*$/.test(environment.EXPO_PUBLIC_APP_SCHEME)
    ) {
      context.addIssue({
        code: "custom",
        message: "EXPO_PUBLIC_APP_SCHEME must be a valid URI scheme.",
        path: ["EXPO_PUBLIC_APP_SCHEME"],
      });
    }

    for (const originValue of environment.MOBILE_ALLOWED_ORIGINS?.split(",") ?? []) {
      const origin = originValue.trim();
      if (origin.includes("*")) {
        context.addIssue({
          code: "custom",
          message: "MOBILE_ALLOWED_ORIGINS must not contain wildcard origins.",
          path: ["MOBILE_ALLOWED_ORIGINS"],
        });
        break;
      }

      try {
        new URL(origin.trim());
      } catch {
        context.addIssue({
          code: "custom",
          message: "MOBILE_ALLOWED_ORIGINS must contain comma-separated absolute URLs.",
          path: ["MOBILE_ALLOWED_ORIGINS"],
        });
        break;
      }

      if (environment.APP_ENV === "production" && !isExactProductionOrigin(origin)) {
        context.addIssue({
          code: "custom",
          message:
            "MOBILE_ALLOWED_ORIGINS must contain exact, non-local HTTPS origins in production.",
          path: ["MOBILE_ALLOWED_ORIGINS"],
        });
        break;
      }
    }
  });

type RawServerConfig = z.output<typeof rawServerConfigSchema>;

export type OAuthProviderConfig =
  { enabled: false } | { clientId: string; clientSecret: string; enabled: true };

function oauthProvider(
  enabled: boolean,
  clientId: string | undefined,
  clientSecret: string | undefined,
): OAuthProviderConfig {
  return enabled
    ? { clientId: clientId as string, clientSecret: clientSecret as string, enabled: true }
    : { enabled: false };
}

/**
 * Connected-account OAuth app credentials (Settings → Connections). Unlike
 * sign-in providers the secret is optional ONLY for X, which supports public
 * PKCE-only clients; Google/Microsoft are confidential clients — a client id
 * without a secret leaves the provider disabled rather than half-enabled.
 */
export type ConnectedAccountProviderConfig =
  { enabled: false } | { clientId: string; clientSecret?: string; enabled: true };

function connectedAccountProvider(
  clientId: string | undefined,
  clientSecret: string | undefined,
  options: { allowPublicClient?: boolean } = {},
): ConnectedAccountProviderConfig {
  const secretRequired = options.allowPublicClient !== true;
  if (clientId === undefined || (secretRequired && clientSecret === undefined)) {
    return { enabled: false };
  }
  return {
    clientId,
    enabled: true,
    ...(clientSecret === undefined ? {} : { clientSecret }),
  };
}

function parseAdminEmails(value: string | undefined): string[] {
  const emails = value
    ?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
  return [...new Set(emails ?? [])];
}

function allowedOrigins(value: string | undefined, fallback: string): string[] {
  const parsedOrigins = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return parsedOrigins?.length ? parsedOrigins : [fallback];
}

function toServerConfig(environment: RawServerConfig) {
  const webUrl = environment.APP_URL ?? "http://localhost:3000";
  const apiUrl = environment.EXPO_PUBLIC_API_URL ?? webUrl;
  const emailFrom = environment.EMAIL_FROM ?? "supastack <hello@example.test>";

  const ai =
    environment.AI_PROVIDER === "openai"
      ? { apiKey: environment.OPENAI_API_KEY as string, kind: "openai" as const }
      : environment.AI_PROVIDER === "anthropic"
        ? { apiKey: environment.ANTHROPIC_API_KEY as string, kind: "anthropic" as const }
        : environment.AI_PROVIDER === "openai-compatible"
          ? {
              apiKey: environment.OPENAI_COMPATIBLE_API_KEY as string,
              baseUrl: environment.OPENAI_COMPATIBLE_BASE_URL as string,
              kind: "openai-compatible" as const,
            }
          : environment.AI_PROVIDER === "openrouter"
            ? {
                apiKey: environment.OPENROUTER_API_KEY as string,
                kind: "openrouter" as const,
                ...(environment.OPENROUTER_APP_NAME
                  ? { appName: environment.OPENROUTER_APP_NAME }
                  : {}),
                ...(environment.OPENROUTER_SITE_URL
                  ? { siteUrl: environment.OPENROUTER_SITE_URL }
                  : {}),
              }
            : { kind: "fake" as const };
  const billing =
    environment.BILLING_PROVIDER === "stripe"
      ? {
          kind: "stripe" as const,
          priceId: environment.STRIPE_PRICE_ID as string,
          secretKey: environment.STRIPE_SECRET_KEY as string,
          webhookSecret: environment.STRIPE_WEBHOOK_SECRET as string,
        }
      : environment.BILLING_PROVIDER === "lemonsqueezy"
        ? {
            apiKey: environment.LEMONSQUEEZY_API_KEY as string,
            kind: "lemonsqueezy" as const,
            priceId: environment.LEMONSQUEEZY_VARIANT_ID as string,
            storeId: environment.LEMONSQUEEZY_STORE_ID as string,
            webhookSecret: environment.LEMONSQUEEZY_WEBHOOK_SECRET as string,
          }
        : environment.BILLING_PROVIDER === "creem"
          ? {
              apiKey: environment.CREEM_API_KEY as string,
              kind: "creem" as const,
              priceId: environment.CREEM_PRODUCT_ID as string,
              testMode: environment.CREEM_TEST_MODE,
              webhookSecret: environment.CREEM_WEBHOOK_SECRET as string,
            }
          : environment.BILLING_PROVIDER === "polar"
            ? {
                accessToken: environment.POLAR_ACCESS_TOKEN as string,
                kind: "polar" as const,
                priceId: environment.POLAR_PRODUCT_ID as string,
                server: environment.POLAR_SERVER,
                webhookSecret: environment.POLAR_WEBHOOK_SECRET as string,
              }
            : environment.BILLING_PROVIDER === "whop"
              ? {
                  apiKey: environment.WHOP_API_KEY as string,
                  kind: "whop" as const,
                  priceId: environment.WHOP_PLAN_ID as string,
                  webhookSecret: environment.WHOP_WEBHOOK_SECRET as string,
                }
              : environment.BILLING_PROVIDER === "paddle"
                ? {
                    apiKey: environment.PADDLE_API_KEY as string,
                    environment: environment.PADDLE_ENVIRONMENT,
                    kind: "paddle" as const,
                    priceId: environment.PADDLE_PRICE_ID as string,
                    webhookSecret: environment.PADDLE_WEBHOOK_SECRET as string,
                  }
                : environment.BILLING_PROVIDER === "dodo"
                  ? {
                      apiKey: environment.DODO_PAYMENTS_API_KEY as string,
                      environment: environment.DODO_PAYMENTS_ENVIRONMENT,
                      kind: "dodo" as const,
                      priceId: environment.DODO_PRODUCT_ID as string,
                      webhookSecret: environment.DODO_PAYMENTS_WEBHOOK_KEY as string,
                    }
                  : environment.BILLING_PROVIDER === "paypal"
                    ? {
                        clientId: environment.PAYPAL_CLIENT_ID as string,
                        clientSecret: environment.PAYPAL_CLIENT_SECRET as string,
                        environment: environment.PAYPAL_ENVIRONMENT,
                        kind: "paypal" as const,
                        priceId: environment.PAYPAL_PLAN_ID as string,
                        webhookSecret: environment.PAYPAL_WEBHOOK_ID as string,
                      }
                    : { kind: "local" as const };
  const email =
    environment.EMAIL_PROVIDER === "resend"
      ? { apiKey: environment.RESEND_API_KEY as string, from: emailFrom, kind: "resend" as const }
      : environment.EMAIL_PROVIDER === "ses"
        ? {
            ...(environment.AWS_ACCESS_KEY_ID
              ? { accessKeyId: environment.AWS_ACCESS_KEY_ID }
              : {}),
            from: emailFrom,
            kind: "ses" as const,
            region: environment.AWS_REGION ?? "us-east-1",
            ...(environment.AWS_SECRET_ACCESS_KEY
              ? { secretAccessKey: environment.AWS_SECRET_ACCESS_KEY }
              : {}),
            ...(environment.AWS_SESSION_TOKEN
              ? { sessionToken: environment.AWS_SESSION_TOKEN }
              : {}),
          }
        : environment.EMAIL_PROVIDER === "postmark"
          ? {
              from: emailFrom,
              kind: "postmark" as const,
              serverToken: environment.POSTMARK_SERVER_TOKEN as string,
            }
          : environment.EMAIL_PROVIDER === "sendgrid"
            ? {
                apiKey: environment.SENDGRID_API_KEY as string,
                from: emailFrom,
                kind: "sendgrid" as const,
              }
            : environment.EMAIL_PROVIDER === "mailgun"
              ? {
                  apiKey: environment.MAILGUN_API_KEY as string,
                  domain: environment.MAILGUN_DOMAIN as string,
                  from: emailFrom,
                  kind: "mailgun" as const,
                  region: environment.MAILGUN_REGION,
                }
              : environment.EMAIL_PROVIDER === "smtp"
                ? {
                    from: emailFrom,
                    host: environment.SMTP_HOST as string,
                    kind: "smtp" as const,
                    ...(environment.SMTP_PASSWORD === undefined
                      ? {}
                      : { password: environment.SMTP_PASSWORD }),
                    port: environment.SMTP_PORT ?? 587,
                    secure: environment.SMTP_SECURE,
                    ...(environment.SMTP_USER === undefined ? {} : { user: environment.SMTP_USER }),
                  }
                : environment.EMAIL_PROVIDER === "brevo"
                  ? {
                      apiKey: environment.BREVO_API_KEY as string,
                      from: emailFrom,
                      kind: "brevo" as const,
                    }
                  : { from: emailFrom, kind: "local" as const };
  const jobs =
    environment.JOB_PROVIDER === "trigger"
      ? {
          kind: "trigger" as const,
          projectRef: environment.TRIGGER_PROJECT_REF as string,
          secretKey: environment.TRIGGER_SECRET_KEY as string,
        }
      : { kind: "local" as const };
  const captcha =
    environment.CAPTCHA_PROVIDER === "turnstile"
      ? {
          kind: "turnstile" as const,
          secretKey: environment.TURNSTILE_SECRET_KEY as string,
          siteKey: environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string,
        }
      : { kind: "off" as const };
  const analytics =
    environment.ANALYTICS_PROVIDER === "plausible" || environment.ANALYTICS_PROVIDER === "posthog"
      ? {
          kind: environment.ANALYTICS_PROVIDER,
          siteId: environment.ANALYTICS_SITE_ID as string,
          ...(environment.ANALYTICS_HOST ? { host: environment.ANALYTICS_HOST } : {}),
        }
      : environment.ANALYTICS_PROVIDER === "local"
        ? { kind: "local" as const }
        : { kind: "off" as const };
  const storage =
    environment.STORAGE_PROVIDER === "s3"
      ? {
          accessKeyId: environment.STORAGE_ACCESS_KEY_ID as string,
          bucket: environment.STORAGE_BUCKET as string,
          endpoint: environment.STORAGE_ENDPOINT,
          // Path-style addressing is required by Supabase Storage and MinIO,
          // so a custom endpoint defaults to true; real AWS S3 defaults to
          // virtual-hosted. STORAGE_FORCE_PATH_STYLE overrides either way.
          forcePathStyle:
            environment.STORAGE_FORCE_PATH_STYLE ?? environment.STORAGE_ENDPOINT !== undefined,
          kind: "s3" as const,
          publicBaseUrl: environment.STORAGE_PUBLIC_BASE_URL,
          region: environment.STORAGE_REGION ?? "us-east-1",
          secretAccessKey: environment.STORAGE_SECRET_ACCESS_KEY as string,
        }
      : { kind: "memory" as const };
  const customDomains =
    environment.CUSTOM_DOMAINS_PROVIDER === "cloudflare"
      ? {
          apiToken: environment.CLOUDFLARE_API_TOKEN as string,
          cnameTarget: environment.CUSTOM_DOMAIN_CNAME_TARGET as string,
          kind: "cloudflare" as const,
          zoneId: environment.CLOUDFLARE_ZONE_ID as string,
        }
      : environment.CUSTOM_DOMAINS_PROVIDER === "local"
        ? { cnameTarget: "customers.localhost", kind: "local" as const }
        : { kind: "off" as const };

  return {
    admin: { emails: parseAdminEmails(environment.ADMIN_EMAILS) },
    agents: { framework: environment.AGENT_FRAMEWORK },
    aiRouting: environment.AI_MODEL_POLICY,
    app: { apiUrl, environment: environment.APP_ENV, webUrl },
    auth: {
      credentialEncryptionKey:
        environment.CREDENTIAL_ENCRYPTION_KEY ?? "local-development-credential-encryption-key",
      engine: environment.AUTH_PROVIDER,
      providers: {
        apple: oauthProvider(
          environment.AUTH_APPLE_ENABLED,
          environment.APPLE_CLIENT_ID,
          environment.APPLE_CLIENT_SECRET,
        ),
        emailOtp: { enabled: true as const },
        github: oauthProvider(
          environment.AUTH_GITHUB_ENABLED,
          environment.GITHUB_CLIENT_ID,
          environment.GITHUB_CLIENT_SECRET,
        ),
        google: oauthProvider(
          environment.AUTH_GOOGLE_ENABLED,
          environment.GOOGLE_CLIENT_ID,
          environment.GOOGLE_CLIENT_SECRET,
        ),
        microsoft: oauthProvider(
          environment.AUTH_MICROSOFT_ENABLED,
          environment.MICROSOFT_CLIENT_ID,
          environment.MICROSOFT_CLIENT_SECRET,
        ),
        password: { enabled: true as const },
        twitter: oauthProvider(
          environment.AUTH_TWITTER_ENABLED,
          environment.TWITTER_CLIENT_ID,
          environment.TWITTER_CLIENT_SECRET,
        ),
      },
      secret: environment.AUTH_SECRET ?? "local-development-auth-secret-not-for-production",
    },
    connectedAccounts: {
      google: connectedAccountProvider(
        environment.CONNECTED_GOOGLE_CLIENT_ID,
        environment.CONNECTED_GOOGLE_CLIENT_SECRET,
      ),
      microsoft: connectedAccountProvider(
        environment.CONNECTED_MICROSOFT_CLIENT_ID,
        environment.CONNECTED_MICROSOFT_CLIENT_SECRET,
      ),
      x: connectedAccountProvider(
        environment.CONNECTED_X_CLIENT_ID,
        environment.CONNECTED_X_CLIENT_SECRET,
        { allowPublicClient: true },
      ),
    },
    customDomains,
    databaseUrl:
      environment.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/supastack",
    earlyAccess: { inviteOnly: environment.EARLY_ACCESS_INVITE_ONLY },
    expo: { accessToken: environment.EXPO_ACCESS_TOKEN },
    mobilePurchases:
      environment.MOBILE_PURCHASES_PROVIDER === "revenuecat"
        ? {
            kind: "revenuecat" as const,
            secretApiKey: environment.REVENUECAT_SECRET_API_KEY as string,
            webhookAuthorization: environment.REVENUECAT_WEBHOOK_AUTHORIZATION as string,
            entitlementId: environment.REVENUECAT_ENTITLEMENT_ID,
            entitlementKey: environment.REVENUECAT_ENTITLEMENT_KEY,
            allowSandbox:
              environment.REVENUECAT_ALLOW_SANDBOX === "true" ||
              (environment.APP_ENV !== "production" &&
                environment.REVENUECAT_ALLOW_SANDBOX !== "false"),
          }
        : { kind: "off" as const },
    mobile: {
      allowedOrigins: allowedOrigins(environment.MOBILE_ALLOWED_ORIGINS, webUrl),
      scheme: environment.EXPO_PUBLIC_APP_SCHEME ?? "supastack",
    },
    observability: {
      ...(environment.ALERT_WEBHOOK_URL ? { alertWebhookUrl: environment.ALERT_WEBHOOK_URL } : {}),
      ...(environment.NEXT_PUBLIC_POSTHOG_HOST
        ? { posthogHost: environment.NEXT_PUBLIC_POSTHOG_HOST }
        : {}),
      ...(environment.NEXT_PUBLIC_POSTHOG_KEY
        ? { posthogKey: environment.NEXT_PUBLIC_POSTHOG_KEY }
        : {}),
      ...(environment.SENTRY_DSN ? { sentryDsn: environment.SENTRY_DSN } : {}),
    },
    providers: { ai, analytics, billing, captcha, email, jobs, storage },
    publicAi: {
      dailyBudgetMicrounits: environment.PUBLIC_AI_DAILY_BUDGET_MICROUNITS ?? 0n,
    },
    rateLimit: {
      store:
        environment.RATE_LIMIT_STORE ??
        (environment.NODE_ENV === "production" ? ("postgres" as const) : ("memory" as const)),
      // Trusted XFF hops appended by infrastructure we control; leading entries
      // are client-controlled. 0 = no trusted proxy (all anonymous → unknown).
      trustedProxyCount: environment.TRUSTED_PROXY_COUNT ?? 0,
    },
    scheduler: { tickSecret: environment.SCHEDULER_TICK_SECRET },
  };
}

export const serverConfigSchema = z.preprocess((value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const environment = value as Record<string, unknown>;
  // Production hosts commonly set NODE_ENV without APP_ENV. Validate them as
  // production before local secrets and provider defaults can be selected.
  return environment.APP_ENV === undefined && environment.NODE_ENV === "production"
    ? { ...environment, APP_ENV: "production" }
    : environment;
}, rawServerConfigSchema.transform(toServerConfig));
export type ServerConfig = z.output<typeof serverConfigSchema>;

export const publicConfigSchema = z
  .object({
    app: z
      .object({
        apiUrl: z.string().url(),
        environment: z.enum(appEnvironments),
        webUrl: z.string().url(),
      })
      .strict(),
    auth: z
      .object({
        providers: z
          .object({
            apple: z.boolean(),
            emailOtp: z.boolean(),
            github: z.boolean(),
            google: z.boolean(),
            microsoft: z.boolean(),
            password: z.boolean(),
            twitter: z.boolean(),
          })
          .strict(),
      })
      .strict(),
    mobile: z
      .object({
        allowedOrigins: z.array(z.string().url()),
        scheme: z.string().regex(/^[a-z][a-z0-9+.-]*$/),
      })
      .strict(),
    captcha: z
      .object({
        provider: z.enum(["off", "turnstile"]),
        turnstileSiteKey: z.string().optional(),
      })
      .strict(),
    observability: z
      .object({
        posthogHost: z.string().url().optional(),
        posthogKey: z.string().optional(),
      })
      .strict(),
    providers: z
      .object({
        ai: z.enum(["fake", "openai", "anthropic", "openai-compatible", "openrouter"]),
        analytics: z.enum(["off", "local", "plausible", "posthog"]),
        auth: z.enum(["better-auth", "authjs"]),
        billing: z.enum([
          "local",
          "stripe",
          "lemonsqueezy",
          "creem",
          "polar",
          "whop",
          "paddle",
          "dodo",
          "paypal",
        ]),
        captcha: z.enum(["off", "turnstile"]),
        customDomains: z.enum(["off", "local", "cloudflare"]),
        email: z.enum([
          "local",
          "resend",
          "ses",
          "postmark",
          "sendgrid",
          "mailgun",
          "smtp",
          "brevo",
        ]),
        jobs: z.enum(["local", "trigger"]),
        storage: z.enum(["memory", "s3"]),
      })
      .strict(),
  })
  .strict();
export type PublicConfig = z.output<typeof publicConfigSchema>;

export function parseServerConfig(
  environment: Record<string, string | undefined> = process.env,
): ServerConfig {
  return serverConfigSchema.parse(environment);
}

export function parsePublicConfig(serverConfig: ServerConfig): PublicConfig {
  return publicConfigSchema.parse({
    app: serverConfig.app,
    auth: {
      providers: {
        apple: serverConfig.auth.providers.apple.enabled,
        emailOtp: serverConfig.auth.providers.emailOtp.enabled,
        github: serverConfig.auth.providers.github.enabled,
        google: serverConfig.auth.providers.google.enabled,
        microsoft: serverConfig.auth.providers.microsoft.enabled,
        password: serverConfig.auth.providers.password.enabled,
        twitter: serverConfig.auth.providers.twitter.enabled,
      },
    },
    mobile: serverConfig.mobile,
    captcha: {
      provider: serverConfig.providers.captcha.kind,
      ...(serverConfig.providers.captcha.kind === "turnstile"
        ? { turnstileSiteKey: serverConfig.providers.captcha.siteKey }
        : {}),
    },
    observability: {
      ...(serverConfig.observability.posthogHost
        ? { posthogHost: serverConfig.observability.posthogHost }
        : {}),
      ...(serverConfig.observability.posthogKey
        ? { posthogKey: serverConfig.observability.posthogKey }
        : {}),
    },
    providers: {
      ai: serverConfig.providers.ai.kind,
      analytics: serverConfig.providers.analytics.kind,
      auth: serverConfig.auth.engine,
      billing: serverConfig.providers.billing.kind,
      captcha: serverConfig.providers.captcha.kind,
      customDomains: serverConfig.customDomains.kind,
      email: serverConfig.providers.email.kind,
      jobs: serverConfig.providers.jobs.kind,
      storage: serverConfig.providers.storage.kind,
    },
  });
}
