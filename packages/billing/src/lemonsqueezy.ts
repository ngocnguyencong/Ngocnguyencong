import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  SignedStripeWebhookRequest,
  SignedStripeWebhookVerification,
  StripeCheckoutRequest,
  StripeCheckoutSession,
  StripeEntitlementStatus,
  StripePortalRequest,
  StripePortalSession,
  VerifiedStripeBillingEvent,
} from "./index";

/**
 * Minimal server-side Lemon Squeezy HTTP surface. Construct the fetch-backed
 * client in the application composition root; credentials never live here.
 */
export interface LemonSqueezyBillingClient {
  createCheckout(input: LemonSqueezyCheckoutCreateInput): Promise<LemonSqueezyCheckoutSession>;
  customerPortalUrl(customerId: string): Promise<LemonSqueezyPortalSession>;
}

export type LemonSqueezyCheckoutCreateInput = Readonly<{
  variantId: string;
  quantity: number;
  checkoutData: Readonly<{
    email?: string;
    custom: Readonly<Record<string, string>>;
  }>;
  productOptions: Readonly<{ redirectUrl: string }>;
}>;

export type LemonSqueezyCheckoutSession = Readonly<{
  id: string;
  url: string | null;
}>;

export type LemonSqueezyPortalSession = Readonly<{
  url: string | null;
}>;

type LemonSqueezyWebhookPayload = Readonly<{
  data?: Readonly<{
    id?: string;
    type?: string;
    attributes?: Readonly<Record<string, unknown>>;
  }>;
  meta?: Readonly<{
    event_name?: string;
    custom_data?: Readonly<Record<string, unknown>>;
  }>;
}>;

/**
 * Second supported billing provider. Shares the framework-neutral BFF contract
 * with the Stripe adapter: same request/verification types, same ledger.
 */
export class LemonSqueezyBillingAdapter {
  constructor(private readonly client: LemonSqueezyBillingClient) {}

  async createCheckoutSession(input: StripeCheckoutRequest): Promise<StripeCheckoutSession> {
    const session = await this.client.createCheckout({
      checkoutData: {
        custom: {
          entitlement: input.entitlement,
          priceId: input.priceId,
          workspaceId: input.workspaceId,
        },
        ...(input.customerEmail === undefined ? {} : { email: input.customerEmail }),
      },
      productOptions: { redirectUrl: input.successUrl },
      quantity:
        input.seats !== undefined &&
        Number.isInteger(input.seats) &&
        input.seats >= 1 &&
        input.seats <= 999
          ? input.seats
          : 1,
      variantId: input.priceId,
    });

    return { id: session.id, url: session.url };
  }

  async createPortalSession(input: StripePortalRequest): Promise<StripePortalSession> {
    const portal = await this.client.customerPortalUrl(input.customerId);
    if (portal.url === null) {
      throw new Error("Lemon Squeezy did not return a customer portal URL.");
    }
    return { url: portal.url };
  }

  verifySignedWebhook(input: SignedStripeWebhookRequest): SignedStripeWebhookVerification {
    if (typeof input !== "object" || input === null) {
      return { verification: "rejected" };
    }
    if (
      typeof input.payload !== "string" ||
      typeof input.signature !== "string" ||
      typeof input.webhookSecret !== "string"
    ) {
      return { verification: "rejected" };
    }

    let expectedBuffer: Buffer;
    try {
      expectedBuffer = createHmac("sha256", input.webhookSecret).update(input.payload).digest();
    } catch {
      return { verification: "rejected" };
    }

    const provided = input.signature.trim().toLowerCase();
    // Malformed signatures decode to a zero-filled buffer of the expected
    // length so the constant-time compare always runs on equal-length buffers
    // — no secret-dependent timing distinction, no length-mismatch throw.
    const providedBuffer = /^[a-f0-9]{64}$/.test(provided)
      ? Buffer.from(provided, "hex")
      : Buffer.alloc(expectedBuffer.length);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return { verification: "rejected" };
    }

    let parsed: LemonSqueezyWebhookPayload;
    try {
      const value: unknown = JSON.parse(input.payload);
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { verification: "rejected" };
      }
      parsed = value;
    } catch {
      return { verification: "rejected" };
    }

    const eventName = parsed.meta?.event_name;
    const data = parsed.data;
    if (eventName === undefined || data?.id === undefined) {
      return { verification: "rejected" };
    }

    const attributes = data.attributes ?? {};
    const customData = parsed.meta?.custom_data ?? {};
    const occurredAt = parseTimestamp(attributes.updated_at ?? attributes.created_at);
    const eventId = `${eventName}:${data.id}:${(occurredAt ?? new Date(0)).toISOString()}`;
    const priceId = referenceId(attributes.variant_id) ?? stringValue(customData.priceId);

    const event: VerifiedStripeBillingEvent = {
      ...(typeof attributes.customer_id === "number" || typeof attributes.customer_id === "string"
        ? { customerId: String(attributes.customer_id) }
        : {}),
      ...(typeof customData.entitlement === "string"
        ? { entitlement: customData.entitlement }
        : {}),
      entitlementStatus: lemonSqueezyEntitlementStatus(eventName, attributes.status),
      eventId,
      eventType: eventName,
      occurredAt: occurredAt ?? new Date(0),
      ...(priceId === undefined ? {} : { priceId }),
      ...(data.type === "subscriptions" ? { subscriptionId: data.id } : {}),
      ...(typeof customData.workspaceId === "string"
        ? { workspaceId: customData.workspaceId }
        : {}),
    };

    return { event, verification: "verified" };
  }
}

function referenceId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function lemonSqueezyEntitlementStatus(
  eventName: string,
  status: unknown,
): StripeEntitlementStatus | null {
  if (eventName === "order_created") {
    return status === "paid" ? "active" : null;
  }
  if (eventName === "subscription_payment_failed") {
    return "past_due";
  }
  if (eventName === "subscription_payment_success" || eventName === "subscription_resumed") {
    return "active";
  }
  if (eventName === "subscription_expired" || eventName === "subscription_cancelled") {
    return "inactive";
  }
  if (eventName === "subscription_created" || eventName === "subscription_updated") {
    switch (status) {
      case "on_trial":
        return "trialing";
      case "active":
        return "active";
      case "past_due":
      case "unpaid":
        return "past_due";
      case "cancelled":
      case "expired":
      case "paused":
        return "inactive";
      default:
        return null;
    }
  }
  return null;
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
