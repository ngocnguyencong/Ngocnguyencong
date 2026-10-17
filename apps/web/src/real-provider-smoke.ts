import { randomBytes } from "node:crypto";

import type { AiProvider } from "@supastack/ai";
import { StripeBillingAdapter, type StripeCheckoutSession } from "@supastack/billing";
import type { EmailSender } from "@supastack/email";
import type { JobRunner } from "@supastack/jobs";

import type { RealProviderSmokeConfig } from "./real-provider-smoke-config.js";
import {
  createServerProviderComposition,
  type OpenAiGenerationLimits,
  type ServerProviderCompositionInput,
} from "./server-provider-composition.js";

const smokePrompt = "Reply with only: SUPASTACK_SMOKE_OK";

/** Hard application-side ceiling in addition to the dedicated provider budget and alert. */
export const realProviderSmokeAiGenerationLimits: OpenAiGenerationLimits = Object.freeze({
  maxOutputTokens: 16,
  maxRetries: 0,
  timeoutMs: 15_000,
});

export type RealProviderSmokeProviders = Readonly<{
  ai: Pick<AiProvider, "complete">;
  billing: Pick<StripeBillingAdapter, "createCheckoutSession">;
  email: Pick<EmailSender, "send">;
  jobs: Pick<JobRunner, "enqueue">;
}>;

export interface RealProviderSmokeInput {
  config: RealProviderSmokeConfig;
  createIntegrationIdentifier?: () => string;
  createProviders?: (input: ServerProviderCompositionInput) => RealProviderSmokeProviders;
}

/**
 * Makes the intentionally tiny, billable provider probes. The caller must
 * parse the fail-closed smoke configuration before calling this function.
 */
export async function runRealProviderSmoke(input: RealProviderSmokeInput): Promise<void> {
  const config = input.config;
  const providers = (input.createProviders ?? createRealProviderSmokeProviders)({
    openAiGenerationLimits: realProviderSmokeAiGenerationLimits,
    serverConfig: config.serverConfig,
  });
  const billing = config.serverConfig.providers.billing;
  if (billing.kind !== "stripe") {
    throw new Error("The provider smoke requires Stripe billing configuration.");
  }

  const completion = await providers.ai.complete({
    input: smokePrompt,
    model: {
      id: `openai:${config.aiModel}`,
      model: config.aiModel,
      modelVersion: config.aiModelVersion,
      provider: "openai",
    },
    workspace: { budget: null, keyMode: "platform", workspaceId: config.workspaceId },
  });
  if (completion.text.trim() !== "SUPASTACK_SMOKE_OK" || completion.usage.inputTokens <= 0n) {
    throw new Error("The real AI smoke response did not meet the bounded contract.");
  }

  const delivery = await providers.email.send({
    category: "transactional",
    subject: "supastack provider smoke",
    text: "Transactional provider connection verified. No action is required.",
    to: config.emailTo,
    workspaceId: config.workspaceId,
  });
  if (delivery.id.trim().length === 0 || delivery.workspaceId !== config.workspaceId) {
    throw new Error("The real transactional email smoke returned an invalid delivery.");
  }

  const checkout = await providers.billing.createCheckoutSession({
    cancelUrl: new URL("/billing?checkout=cancelled", config.serverConfig.app.webUrl).toString(),
    customerEmail: config.emailTo,
    entitlement: "ai.reference-task",
    idempotencyKey: `provider-smoke-${config.workspaceId}`,
    integrationIdentifier: (input.createIntegrationIdentifier ?? createIntegrationIdentifier)(),
    priceId: billing.priceId,
    successUrl: new URL("/billing?checkout=success", config.serverConfig.app.webUrl).toString(),
    workspaceId: config.workspaceId,
  });
  requireCheckoutSession(checkout);

  if (config.triggerTask !== null) {
    const run = await providers.jobs.enqueue({
      input: { smoke: true },
      type: config.triggerTask,
      workspaceId: config.workspaceId,
    });
    if (run.id.trim().length === 0 || run.workspaceId !== config.workspaceId) {
      throw new Error("The real Trigger.dev smoke returned an invalid run.");
    }
  }
}

function createRealProviderSmokeProviders(
  input: ServerProviderCompositionInput,
): RealProviderSmokeProviders {
  const providers = createServerProviderComposition(input);
  const billing = providers.billing;
  if (!(billing instanceof StripeBillingAdapter)) {
    throw new Error("The provider smoke requires Stripe billing.");
  }

  return { ai: providers.ai, billing, email: providers.email, jobs: providers.jobs };
}

function createIntegrationIdentifier(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  return `supastack_${Array.from(randomBytes(8), (value) => alphabet[value % alphabet.length]).join("")}`;
}

function requireCheckoutSession(session: StripeCheckoutSession): void {
  if (
    !session.id.startsWith("cs_") ||
    session.url === null ||
    !session.url.startsWith("https://")
  ) {
    throw new Error("The real Stripe smoke returned an invalid Checkout Session.");
  }
}
