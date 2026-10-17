import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import {
  FakeAiProvider,
  AnthropicProvider,
  OpenAiProvider,
  OpenAiCompatibleProvider,
  OpenRouterProvider,
  type AiProvider,
  type ProviderKeyResolver,
  type ProviderSdkClient,
} from "@supastack/ai";
import {
  CreemBillingAdapter,
  DodoBillingAdapter,
  LemonSqueezyBillingAdapter,
  LocalBillingService,
  PaddleBillingAdapter,
  PaypalBillingAdapter,
  PolarBillingAdapter,
  StripeBillingAdapter,
  WhopBillingAdapter,
  type CreemBillingClient,
  type CreemCheckoutCreateInput,
  type DodoBillingClient,
  type DodoCheckoutCreateInput,
  type LemonSqueezyBillingClient,
  type LemonSqueezyCheckoutCreateInput,
  type PaddleBillingClient,
  type PaddleCustomerPortalSessionInput,
  type PaddleTransactionCreateInput,
  type PaypalBillingClient,
  type PaypalSubscriptionCreateInput,
  type PaypalWebhookVerificationInput,
  type PolarBillingClient,
  type PolarCheckoutCreateInput,
  type StripeBillingClient,
  type WhopBillingClient,
} from "@supastack/billing";
import type { ServerConfig } from "@supastack/config";
import {
  EmailSdkTransactionalEmailSender,
  HtmlTemplatedEmailSender,
  ResendTransactionalEmailSender,
  SesTransactionalEmailSender,
  getSharedLocalOutboxEmailSender,
  type EmailSdkSendClient,
  type EmailSender,
  type ResendTransactionalClient,
  type SesTransactionalClient,
} from "@supastack/email";
import {
  LocalJobRunner,
  TriggerJobRunner,
  type JobRunner,
  type TriggerJobClient,
} from "@supastack/jobs";
import { generateText } from "ai";
import { Polar } from "@polar-sh/sdk";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { Resend } from "resend";
import Stripe from "stripe";
import { configure, runs, tasks } from "@trigger.dev/sdk";
import { WhopClient } from "@whop/sdk";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { createEmailClient } from "@opencoredev/email-sdk";
import { brevo } from "@opencoredev/email-sdk/brevo";
import { mailgun } from "@opencoredev/email-sdk/mailgun";
import { postmark } from "@opencoredev/email-sdk/postmark";
import { sendgrid } from "@opencoredev/email-sdk/sendgrid";
import { smtp } from "@opencoredev/email-sdk/smtp";

type OpenAiConfig = Extract<ServerConfig["providers"]["ai"], { kind: "openai" }>;
type AnthropicConfig = Extract<ServerConfig["providers"]["ai"], { kind: "anthropic" }>;
type OpenAiCompatibleConfig = Extract<
  ServerConfig["providers"]["ai"],
  { kind: "openai-compatible" }
>;
type OpenRouterConfig = Extract<ServerConfig["providers"]["ai"], { kind: "openrouter" }>;
type StripeConfig = Extract<ServerConfig["providers"]["billing"], { kind: "stripe" }>;
type LemonSqueezyConfig = Extract<ServerConfig["providers"]["billing"], { kind: "lemonsqueezy" }>;
type CreemConfig = Extract<ServerConfig["providers"]["billing"], { kind: "creem" }>;
type PolarConfig = Extract<ServerConfig["providers"]["billing"], { kind: "polar" }>;
type WhopConfig = Extract<ServerConfig["providers"]["billing"], { kind: "whop" }>;
type PaddleConfig = Extract<ServerConfig["providers"]["billing"], { kind: "paddle" }>;
type DodoConfig = Extract<ServerConfig["providers"]["billing"], { kind: "dodo" }>;
type PaypalConfig = Extract<ServerConfig["providers"]["billing"], { kind: "paypal" }>;
type ResendConfig = Extract<ServerConfig["providers"]["email"], { kind: "resend" }>;
type SesConfig = Extract<ServerConfig["providers"]["email"], { kind: "ses" }>;
type EmailSdkConfig = Extract<
  ServerConfig["providers"]["email"],
  { kind: "brevo" | "mailgun" | "postmark" | "sendgrid" | "smtp" }
>;
type TriggerConfig = Extract<ServerConfig["providers"]["jobs"], { kind: "trigger" }>;

export type ServerProviderComposition = Readonly<{
  ai: AiProvider;
  billing:
    | CreemBillingAdapter
    | DodoBillingAdapter
    | LemonSqueezyBillingAdapter
    | LocalBillingService
    | PaddleBillingAdapter
    | PaypalBillingAdapter
    | PolarBillingAdapter
    | StripeBillingAdapter
    | WhopBillingAdapter;
  email: EmailSender;
  jobs: JobRunner;
}>;

/** Explicit only for bounded credentialed smoke calls; normal provider use keeps SDK defaults. */
export type OpenAiGenerationLimits = Readonly<{
  maxOutputTokens: number;
  maxRetries: number;
  timeoutMs: number;
}>;

/**
 * Injectable SDK constructors keep composition tests offline while making the
 * production SDK edge explicit and server-only.
 */
export interface ServerProviderFactories {
  createAnthropicClient?(
    config: AnthropicConfig,
    limits?: OpenAiGenerationLimits,
  ): ProviderSdkClient;
  createOpenAiClient(config: OpenAiConfig, limits?: OpenAiGenerationLimits): ProviderSdkClient;
  createOpenAiCompatibleClient?(
    config: OpenAiCompatibleConfig,
    limits?: OpenAiGenerationLimits,
  ): ProviderSdkClient;
  createOpenRouterClient?(
    config: OpenRouterConfig,
    limits?: OpenAiGenerationLimits,
  ): ProviderSdkClient;
  createResendClient(config: ResendConfig): ResendTransactionalClient;
  createSesClient(config: SesConfig): SesTransactionalClient;
  createEmailSdkClient?(config: EmailSdkConfig): EmailSdkSendClient;
  createStripeClient(config: StripeConfig): StripeBillingClient;
  createLemonSqueezyClient?(config: LemonSqueezyConfig): LemonSqueezyBillingClient;
  createCreemClient?(config: CreemConfig): CreemBillingClient;
  createPolarClient?(config: PolarConfig): PolarBillingClient;
  createWhopClient?(config: WhopConfig): WhopBillingClient;
  createPaddleClient?(config: PaddleConfig): PaddleBillingClient;
  createDodoClient?(config: DodoConfig): DodoBillingClient;
  createPaypalClient?(config: PaypalConfig): PaypalBillingClient;
  createTriggerClient(config: TriggerConfig): TriggerJobClient;
}

export interface ServerProviderCompositionInput {
  factories?: ServerProviderFactories;
  openAiGenerationLimits?: OpenAiGenerationLimits;
  providerKeyResolver?: ProviderKeyResolver;
  serverConfig: ServerConfig;
}

/**
 * Composes exactly the providers approved for the credentialed smoke path.
 * This is intentionally not used by the fake/local golden path.
 */
export function createServerProviderComposition(
  input: ServerProviderCompositionInput,
): ServerProviderComposition {
  const factories = input.factories ?? defaultServerProviderFactories;
  const providers = input.serverConfig.providers;

  return Object.freeze({
    ai: createAiProvider(
      providers.ai,
      factories,
      input.openAiGenerationLimits,
      input.providerKeyResolver,
    ),
    billing: createServerBillingAdapter(providers.billing, factories),
    email: createServerTransactionalEmailSender(providers.email, factories),
    jobs: createJobRunner(providers.jobs, factories),
  });
}

function createAiProvider(
  config: ServerConfig["providers"]["ai"],
  factories: ServerProviderFactories,
  limits: OpenAiGenerationLimits | undefined,
  providerKeyResolver: ProviderKeyResolver | undefined,
): AiProvider {
  if (config.kind === "fake") {
    return new FakeAiProvider("fake");
  }

  if (config.kind === "openai") {
    return new OpenAiProvider(
      factories.createOpenAiClient(config, limits),
      providerKeyResolver ?? createConfiguredPlatformKeyResolver(config),
    );
  }

  if (config.kind === "anthropic") {
    return new AnthropicProvider(
      (factories.createAnthropicClient ?? defaultServerProviderFactories.createAnthropicClient!)(
        config,
        limits,
      ),
      providerKeyResolver ?? createConfiguredPlatformKeyResolver(config),
    );
  }

  if (config.kind === "openai-compatible") {
    return new OpenAiCompatibleProvider(
      "openai-compatible",
      (
        factories.createOpenAiCompatibleClient ??
        defaultServerProviderFactories.createOpenAiCompatibleClient!
      )(config, limits),
      providerKeyResolver ?? createConfiguredPlatformKeyResolver(config),
    );
  }

  if (config.kind === "openrouter") {
    return new OpenRouterProvider(
      (factories.createOpenRouterClient ?? defaultServerProviderFactories.createOpenRouterClient!)(
        config,
        limits,
      ),
      providerKeyResolver ?? createConfiguredPlatformKeyResolver(config),
    );
  }

  return assertNever(config);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported provider configuration: ${String(value)}`);
}

export function createServerBillingAdapter(
  config: ServerConfig["providers"]["billing"],
  factories: Pick<
    ServerProviderFactories,
    | "createCreemClient"
    | "createDodoClient"
    | "createLemonSqueezyClient"
    | "createPaddleClient"
    | "createPaypalClient"
    | "createPolarClient"
    | "createStripeClient"
    | "createWhopClient"
  > = defaultServerProviderFactories,
):
  | CreemBillingAdapter
  | DodoBillingAdapter
  | LemonSqueezyBillingAdapter
  | LocalBillingService
  | PaddleBillingAdapter
  | PaypalBillingAdapter
  | PolarBillingAdapter
  | StripeBillingAdapter
  | WhopBillingAdapter {
  if (config.kind === "local") {
    return new LocalBillingService();
  }
  if (config.kind === "lemonsqueezy") {
    return new LemonSqueezyBillingAdapter(
      (
        factories.createLemonSqueezyClient ??
        defaultServerProviderFactories.createLemonSqueezyClient!
      )(config),
    );
  }
  if (config.kind === "creem") {
    return new CreemBillingAdapter(
      (factories.createCreemClient ?? defaultServerProviderFactories.createCreemClient!)(config),
    );
  }
  if (config.kind === "polar") {
    return new PolarBillingAdapter(
      (factories.createPolarClient ?? defaultServerProviderFactories.createPolarClient!)(config),
    );
  }
  if (config.kind === "whop") {
    return new WhopBillingAdapter(
      (factories.createWhopClient ?? defaultServerProviderFactories.createWhopClient!)(config),
    );
  }
  if (config.kind === "paddle") {
    return new PaddleBillingAdapter(
      (factories.createPaddleClient ?? defaultServerProviderFactories.createPaddleClient!)(config),
    );
  }
  if (config.kind === "dodo") {
    return new DodoBillingAdapter(
      (factories.createDodoClient ?? defaultServerProviderFactories.createDodoClient!)(config),
    );
  }
  if (config.kind === "paypal") {
    return new PaypalBillingAdapter(
      (factories.createPaypalClient ?? defaultServerProviderFactories.createPaypalClient!)(config),
    );
  }
  return new StripeBillingAdapter(factories.createStripeClient(config));
}

export function createServerTransactionalEmailSender(
  config: ServerConfig["providers"]["email"],
  factories: Pick<
    ServerProviderFactories,
    "createEmailSdkClient" | "createResendClient" | "createSesClient"
  > = defaultServerProviderFactories,
): EmailSender {
  const inner =
    config.kind === "local"
      ? getSharedLocalOutboxEmailSender()
      : config.kind === "resend"
        ? new ResendTransactionalEmailSender(factories.createResendClient(config), config.from)
        : config.kind === "ses"
          ? new SesTransactionalEmailSender(factories.createSesClient(config), config.from)
          : new EmailSdkTransactionalEmailSender(
              (
                factories.createEmailSdkClient ??
                defaultServerProviderFactories.createEmailSdkClient!
              )(config),
              config.from,
              config.kind,
            );
  return new HtmlTemplatedEmailSender(inner);
}

function createJobRunner(
  config: ServerConfig["providers"]["jobs"],
  factories: ServerProviderFactories,
): JobRunner {
  return config.kind === "local"
    ? new LocalJobRunner()
    : new TriggerJobRunner(factories.createTriggerClient(config));
}

function createConfiguredPlatformKeyResolver(
  config: OpenAiConfig | AnthropicConfig | OpenAiCompatibleConfig | OpenRouterConfig,
): ProviderKeyResolver {
  return {
    async resolve(input) {
      if (input.keyMode !== "platform" || input.provider !== config.kind) {
        throw new Error("A BYOK provider key must be resolved by the server-side key vault.");
      }

      return config.apiKey;
    },
  };
}

const defaultServerProviderFactories: ServerProviderFactories = {
  createAnthropicClient(_config, limits) {
    return {
      async generate(input) {
        const anthropic = createAnthropic({ apiKey: input.apiKey });
        const result = await generateText({
          ...(limits === undefined
            ? {}
            : {
                maxOutputTokens: limits.maxOutputTokens,
                maxRetries: limits.maxRetries,
                timeout: limits.timeoutMs,
              }),
          model: anthropic(input.model),
          prompt: promptFromProviderInput(input.input),
          ...(input.signal === undefined ? {} : { abortSignal: input.signal }),
        });

        return completionFromGenerateText(result);
      },
    };
  },
  createOpenAiClient(_config, limits) {
    return {
      async generate(input) {
        const openai = createOpenAI({ apiKey: input.apiKey });
        const result = await generateText({
          ...(limits === undefined
            ? {}
            : {
                maxOutputTokens: limits.maxOutputTokens,
                maxRetries: limits.maxRetries,
                timeout: limits.timeoutMs,
              }),
          model: openai(input.model),
          prompt: promptFromProviderInput(input.input),
          ...(input.signal === undefined ? {} : { abortSignal: input.signal }),
        });

        return completionFromGenerateText(result);
      },
    };
  },
  createOpenAiCompatibleClient(config, limits) {
    return {
      async generate(input) {
        const compatible = createOpenAI({ apiKey: input.apiKey, baseURL: config.baseUrl });
        const result = await generateText({
          ...(limits === undefined
            ? {}
            : {
                maxOutputTokens: limits.maxOutputTokens,
                maxRetries: limits.maxRetries,
                timeout: limits.timeoutMs,
              }),
          // `.chat` pins Chat Completions — compatible gateways (new-api,
          // LiteLLM, Ollama, vLLM) don't serve the Responses API the
          // `compatible(model)` shorthand targets.
          model: compatible.chat(input.model),
          prompt: promptFromProviderInput(input.input),
          ...(input.signal === undefined ? {} : { abortSignal: input.signal }),
        });

        return completionFromGenerateText(result);
      },
    };
  },
  createOpenRouterClient(config, limits) {
    return {
      async generate(input) {
        const openrouter = createOpenRouter({
          apiKey: input.apiKey,
          headers: {
            ...(config.appName === undefined ? {} : { "X-Title": config.appName }),
            ...(config.siteUrl === undefined ? {} : { "HTTP-Referer": config.siteUrl }),
          },
        });
        const result = await generateText({
          ...(limits === undefined
            ? {}
            : {
                maxOutputTokens: limits.maxOutputTokens,
                maxRetries: limits.maxRetries,
                timeout: limits.timeoutMs,
              }),
          model: openrouter(input.model),
          prompt: promptFromProviderInput(input.input),
          ...(input.signal === undefined ? {} : { abortSignal: input.signal }),
        });

        return completionFromGenerateText(result);
      },
    };
  },
  createResendClient(config) {
    const client: ResendTransactionalClient = new Resend(config.apiKey);
    return client;
  },
  createEmailSdkClient(config) {
    // Telemetry stays disabled on every path; EMAIL_SDK_TELEMETRY=0 and
    // DO_NOT_TRACK=1 are documented environment-level opt-outs as well.
    const options = { telemetry: false } as const;
    if (config.kind === "postmark") {
      return createEmailClient({
        adapters: [postmark({ serverToken: config.serverToken })],
        ...options,
      });
    }
    if (config.kind === "sendgrid") {
      return createEmailClient({
        adapters: [sendgrid({ apiKey: config.apiKey })],
        ...options,
      });
    }
    if (config.kind === "mailgun") {
      return createEmailClient({
        adapters: [
          mailgun({
            apiKey: config.apiKey,
            domain: config.domain,
            ...(config.region === "eu" ? { baseUrl: "https://api.eu.mailgun.net" } : {}),
          }),
        ],
        ...options,
      });
    }
    if (config.kind === "smtp") {
      return createEmailClient({
        adapters: [
          smtp({
            host: config.host,
            port: config.port,
            secure: config.secure,
            ...(config.user === undefined || config.password === undefined
              ? {}
              : { auth: { user: config.user, pass: config.password } }),
          }),
        ],
        ...options,
      });
    }
    return createEmailClient({
      adapters: [brevo({ apiKey: config.apiKey })],
      ...options,
    });
  },
  createSesClient(config) {
    const client = new SESv2Client({
      // Omit credentials entirely to retain the SDK's role/profile provider chain.
      ...(config.accessKeyId && config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
              ...(config.sessionToken ? { sessionToken: config.sessionToken } : {}),
            },
          }
        : {}),
      region: config.region,
    });

    return {
      createSendEmailCommand(input) {
        return new SendEmailCommand(input);
      },
      async send(command) {
        if (!(command instanceof SendEmailCommand)) {
          throw new Error("SES received an unexpected command type.");
        }

        const result = await client.send(command);
        return result.MessageId === undefined ? {} : { MessageId: result.MessageId };
      },
    };
  },
  createStripeClient(config) {
    const stripe = new Stripe(config.secretKey, {
      apiVersion: "2026-08-26.dahlia",
      appInfo: { name: "Noah supastack", version: "0.1.0" },
    });
    return {
      billingPortal: stripe.billingPortal,
      checkout: stripe.checkout,
      webhooks: {
        constructEvent(payload, signature, secret) {
          const event = stripe.webhooks.constructEvent(payload, signature, secret);
          const object = stripeEventObject(event);
          const customerId = stripeEventCustomerId(object);
          const objectId = stringProperty(object, "id");
          const paymentStatus = stringProperty(object, "payment_status");
          const status = stringProperty(object, "status");
          const subscriptionId = stripeEventSubscriptionId(event, object);

          return {
            created: event.created,
            data: {
              object: {
                metadata: stripeEventMetadata(object),
                ...(customerId === undefined ? {} : { customerId }),
                ...(objectId === undefined ? {} : { id: objectId }),
                ...(paymentStatus === undefined ? {} : { paymentStatus }),
                ...(status === undefined ? {} : { status }),
                ...(subscriptionId === undefined ? {} : { subscriptionId }),
              },
            },
            id: event.id,
            type: event.type,
          };
        },
      },
    };
  },
  createLemonSqueezyClient(config) {
    const request = async (path: string, init?: RequestInit) => {
      const response = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
        ...init,
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/vnd.api+json",
        },
      });
      if (!response.ok) {
        throw new Error(`Lemon Squeezy request failed with status ${response.status}.`);
      }
      const body: unknown = await response.json();
      return objectRecord(body);
    };

    return {
      async createCheckout(input: LemonSqueezyCheckoutCreateInput) {
        const body = await request("/checkouts", {
          body: JSON.stringify({
            data: {
              attributes: {
                checkout_data: {
                  custom: input.checkoutData.custom,
                  ...(input.checkoutData.email === undefined
                    ? {}
                    : { email: input.checkoutData.email }),
                  quantity: input.quantity,
                },
                product_options: {
                  redirect_url: input.productOptions.redirectUrl,
                },
              },
              relationships: {
                store: { data: { id: config.storeId, type: "stores" } },
                variant: { data: { id: input.variantId, type: "variants" } },
              },
              type: "checkouts",
            },
          }),
          method: "POST",
        });
        const data = objectRecord(body?.data);
        const attributes = objectRecord(data?.attributes);
        const url = attributes?.url;
        return {
          id: typeof data?.id === "string" ? data.id : "",
          url: typeof url === "string" ? url : null,
        };
      },
      async customerPortalUrl(customerId: string) {
        const body = await request(`/customers/${encodeURIComponent(customerId)}`);
        const data = objectRecord(body?.data);
        const attributes = objectRecord(data?.attributes);
        const urls = objectRecord(attributes?.urls);
        const url = urls?.customer_portal;
        return { url: typeof url === "string" ? url : null };
      },
    };
  },
  createCreemClient(config) {
    const baseUrl = config.testMode ? "https://test-api.creem.io/v1" : "https://api.creem.io/v1";
    const request = async (path: string, init?: RequestInit) => {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
        },
      });
      if (!response.ok) {
        throw new Error(`Creem request failed with status ${response.status}.`);
      }
      const body: unknown = await response.json();
      return objectRecord(body);
    };

    return {
      async createCheckout(input: CreemCheckoutCreateInput) {
        const body = await request("/checkouts", {
          body: JSON.stringify({
            ...(input.customerEmail === undefined
              ? {}
              : { customer: { email: input.customerEmail } }),
            metadata: input.metadata,
            product_id: input.productId,
            request_id: input.requestId,
            success_url: input.successUrl,
            units: input.units,
          }),
          method: "POST",
        });
        const id = body?.id;
        const url = body?.checkout_url;
        return {
          id: typeof id === "string" ? id : "",
          url: typeof url === "string" ? url : null,
        };
      },
      async customerPortalLink(customerId: string) {
        const body = await request("/customers/billing", {
          body: JSON.stringify({ customer_id: customerId }),
          method: "POST",
        });
        const url = body?.customer_portal_link;
        return { url: typeof url === "string" ? url : null };
      },
    };
  },
  createPolarClient(config) {
    const polar = new Polar({ accessToken: config.accessToken, server: config.server });
    return {
      async createCheckout(input: PolarCheckoutCreateInput) {
        const checkout = await polar.checkouts.create({
          ...(input.customerEmail === undefined ? {} : { customerEmail: input.customerEmail }),
          ...(input.externalCustomerId === undefined
            ? {}
            : { externalCustomerId: input.externalCustomerId }),
          metadata: input.metadata,
          products: [...input.products],
          ...(input.seats === undefined ? {} : { seats: input.seats }),
          successUrl: input.successUrl,
        });
        return { id: checkout.id, url: checkout.url };
      },
      async createCustomerSession(input) {
        const session = await polar.customerSessions.create({ customerId: input.customerId });
        return { url: session.customerPortalUrl };
      },
      validateWebhook(body, headers, secret) {
        return validateEvent(body, headers, secret);
      },
    };
  },
  createWhopClient(config) {
    const whop = new WhopClient({ token: config.apiKey });
    return {
      async createCheckoutConfiguration(input) {
        const configuration = await whop.checkoutConfigurations.create({
          metadata: input.metadata,
          plan_id: input.planId,
          redirect_url: input.redirectUrl,
        });
        return {
          id: configuration.id,
          url: configuration.purchase_url ?? null,
        };
      },
      async retrieveMembership(membershipId) {
        const membership = await whop.memberships.retrieve({ id: membershipId });
        // `manage_url` is returned by the Whop API but is absent from the SDK's
        // Membership type at this version; read it defensively.
        const manageUrl = (membership as { manage_url?: string | null }).manage_url;
        return { manageUrl: typeof manageUrl === "string" ? manageUrl : null };
      },
      unwrapWebhook(body, headers, secret) {
        return unwrapWebhook(body, { headers, key: secret });
      },
    };
  },
  createPaddleClient(config) {
    const baseUrl =
      config.environment === "production"
        ? "https://api.paddle.com"
        : "https://sandbox-api.paddle.com";
    const request = async (path: string, init?: RequestInit) => {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Paddle-Version": "1",
        },
      });
      if (!response.ok) {
        throw new Error(`Paddle request failed with status ${response.status}.`);
      }
      const body: unknown = await response.json();
      return objectRecord(body);
    };

    return {
      async createTransaction(input: PaddleTransactionCreateInput) {
        // Transactions take `customer_id` (`ctm_…`) only — a checkout email means
        // creating the customer first; with no email, checkout collects it.
        let customerId: string | undefined;
        if (input.customerEmail !== undefined) {
          const customer = await request("/customers", {
            body: JSON.stringify({ email: input.customerEmail }),
            method: "POST",
          });
          const data = objectRecord(customer?.data);
          customerId = typeof data?.id === "string" ? data.id : undefined;
        }

        const body = await request("/transactions", {
          body: JSON.stringify({
            collection_mode: "automatic",
            custom_data: input.customData,
            ...(customerId === undefined ? {} : { customer_id: customerId }),
            items: input.items.map((item) => ({
              price_id: item.priceId,
              quantity: item.quantity,
            })),
          }),
          method: "POST",
        });
        const data = objectRecord(body?.data);
        const checkout = objectRecord(data?.checkout);
        const url = checkout?.url;
        return {
          id: typeof data?.id === "string" ? data.id : "",
          url: typeof url === "string" ? url : null,
        };
      },
      async createCustomerPortalSession(input: PaddleCustomerPortalSessionInput) {
        const body = await request(
          `/customers/${encodeURIComponent(input.customerId)}/portal-sessions`,
          { body: JSON.stringify({}), method: "POST" },
        );
        const data = objectRecord(body?.data);
        const urls = objectRecord(data?.urls);
        const general = objectRecord(urls?.general);
        const url = general?.overview;
        return { url: typeof url === "string" ? url : null };
      },
    };
  },
  createDodoClient(config) {
    const baseUrl =
      config.environment === "live_mode"
        ? "https://live.dodopayments.com"
        : "https://test.dodopayments.com";
    const request = async (path: string, init?: RequestInit) => {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Dodo Payments request failed with status ${response.status}.`);
      }
      const body: unknown = await response.json();
      return objectRecord(body);
    };

    return {
      async createCheckout(input: DodoCheckoutCreateInput) {
        const body = await request("/checkouts", {
          body: JSON.stringify({
            ...(input.customerEmail === undefined
              ? {}
              : { customer: { email: input.customerEmail } }),
            metadata: input.metadata,
            product_cart: [{ product_id: input.productId, quantity: input.quantity }],
            return_url: input.returnUrl,
          }),
          method: "POST",
        });
        const id = body?.session_id;
        const url = body?.checkout_url;
        return {
          id: typeof id === "string" ? id : "",
          url: typeof url === "string" ? url : null,
        };
      },
      async createCustomerPortalLink(customerId: string, returnUrl?: string) {
        const query = returnUrl === undefined ? "" : `?return_url=${encodeURIComponent(returnUrl)}`;
        const body = await request(
          `/customers/${encodeURIComponent(customerId)}/customer-portal/session${query}`,
          { method: "POST" },
        );
        const url = body?.link;
        return { url: typeof url === "string" ? url : null };
      },
    };
  },
  createPaypalClient(config) {
    const apiBase =
      config.environment === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
    // PayPal has no hosted portal-session API; the autopay dashboard is the
    // documented buyer self-service surface for managing subscriptions.
    const portalUrl =
      config.environment === "live"
        ? "https://www.paypal.com/myaccount/autopay/"
        : "https://www.sandbox.paypal.com/myaccount/autopay/";

    // Client-credentials tokens live ~9h; cache and refresh with a margin.
    let token: { accessToken: string; expiresAt: number } | null = null;
    const accessToken = async (): Promise<string> => {
      if (token !== null && token.expiresAt > Date.now()) {
        return token.accessToken;
      }
      const response = await fetch(`${apiBase}/v1/oauth2/token`, {
        body: "grant_type=client_credentials",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`PayPal auth failed with status ${response.status}.`);
      }
      const body = objectRecord(await response.json());
      const value = body?.access_token;
      if (typeof value !== "string" || value === "") {
        throw new Error("PayPal auth did not return an access token.");
      }
      const expiresIn = typeof body?.expires_in === "number" ? body.expires_in : 32_400;
      token = {
        accessToken: value,
        expiresAt: Date.now() + Math.max(expiresIn - 300, 60) * 1000,
      };
      return value;
    };
    const request = async (path: string, init?: RequestInit) => {
      const response = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${await accessToken()}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`PayPal request failed with status ${response.status}.`);
      }
      const body: unknown = await response.json();
      return objectRecord(body);
    };

    return {
      async createSubscription(input: PaypalSubscriptionCreateInput) {
        const body = await request("/v1/billing/subscriptions", {
          body: JSON.stringify({
            application_context: {
              cancel_url: input.cancelUrl,
              return_url: input.returnUrl,
              user_action: "SUBSCRIBE_NOW",
            },
            custom_id: input.customId,
            plan_id: input.planId,
            ...(input.subscriberEmail === undefined
              ? {}
              : { subscriber: { email_address: input.subscriberEmail } }),
          }),
          method: "POST",
        });
        const links = Array.isArray(body?.links) ? body.links : [];
        const approve = links
          .map((link) => objectRecord(link))
          .find((link) => link?.rel === "approve");
        const url = approve?.href;
        return {
          id: typeof body?.id === "string" ? body.id : "",
          url: typeof url === "string" ? url : null,
        };
      },
      async subscriptionPortalUrl() {
        return { url: portalUrl };
      },
      async verifyWebhookSignature(input: PaypalWebhookVerificationInput) {
        const body = await request("/v1/notifications/verify-webhook-signature", {
          body: JSON.stringify({
            auth_algo: input.authAlgo,
            cert_url: input.certUrl,
            transmission_id: input.transmissionId,
            transmission_sig: input.transmissionSig,
            transmission_time: input.transmissionTime,
            webhook_event: input.webhookEvent,
            webhook_id: input.webhookId,
          }),
          method: "POST",
        });
        const status = body?.verification_status;
        return { verificationStatus: typeof status === "string" ? status : "FAILURE" };
      },
    };
  },
  createTriggerClient(config) {
    configure({ accessToken: config.secretKey });
    const client: TriggerJobClient = { runs, tasks };
    return client;
  },
};

function completionFromGenerateText(
  result: Readonly<{
    text: string;
    totalUsage: Readonly<{ inputTokens: number | undefined; outputTokens: number | undefined }>;
  }>,
) {
  return {
    text: result.text,
    usage: {
      inputTokens: requireUsageCount(result.totalUsage.inputTokens, "inputTokens"),
      outputTokens: requireUsageCount(result.totalUsage.outputTokens, "outputTokens"),
    },
  };
}

function promptFromProviderInput(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }

  if (
    typeof input === "object" &&
    input !== null &&
    "prompt" in input &&
    typeof input.prompt === "string"
  ) {
    return input.prompt;
  }

  return JSON.stringify(input) ?? "undefined";
}

function requireUsageCount(value: number | undefined, name: string): number {
  if (value === undefined) {
    throw new Error(`OpenAI did not return ${name}.`);
  }

  return value;
}

function stripeEventObject(event: Stripe.Event): Readonly<Record<string, unknown>> {
  return objectRecord(event.data.object) ?? {};
}

function stripeEventMetadata(
  object: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string>> | null {
  const direct = stringRecord(object.metadata);
  const parent = objectRecord(object.parent);
  const subscriptionDetails = objectRecord(parent?.subscription_details);
  const subscription = stringRecord(subscriptionDetails?.metadata);

  if (subscription === null) {
    return direct;
  }

  return direct === null ? subscription : { ...subscription, ...direct };
}

function stripeEventCustomerId(object: Readonly<Record<string, unknown>>): string | undefined {
  return resourceId(object.customer);
}

function stripeEventSubscriptionId(
  event: Stripe.Event,
  object: Readonly<Record<string, unknown>>,
): string | undefined {
  if (event.type.startsWith("customer.subscription.")) {
    return resourceId(object.id);
  }

  const direct = resourceId(object.subscription);
  if (direct !== undefined) {
    return direct;
  }

  const parent = objectRecord(object.parent);
  const subscriptionDetails = objectRecord(parent?.subscription_details);
  return resourceId(subscriptionDetails?.subscription);
}

function resourceId(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  return stringProperty(objectRecord(value), "id");
}

function stringProperty(
  value: Readonly<Record<string, unknown>> | null,
  key: string,
): string | undefined {
  const property = value?.[key];
  return typeof property === "string" ? property : undefined;
}

function objectRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function stringRecord(value: unknown): Readonly<Record<string, string>> | null {
  const record = objectRecord(value);
  if (record === null || Object.values(record).some((entry) => typeof entry !== "string")) {
    return null;
  }

  return record as Readonly<Record<string, string>>;
}
