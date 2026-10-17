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
 * Minimal server-side Creem HTTP surface. Construct the fetch-backed client in
 * the application composition root; credentials never live here.
 */
export interface CreemBillingClient {
  createCheckout(input: CreemCheckoutCreateInput): Promise<CreemCheckoutSession>;
  customerPortalLink(customerId: string): Promise<CreemPortalSession>;
}

export type CreemCheckoutCreateInput = Readonly<{
  productId: string;
  units: number;
  requestId: string;
  customerEmail?: string;
  metadata: Readonly<Record<string, string>>;
  successUrl: string;
}>;

export type CreemCheckoutSession = Readonly<{
  id: string;
  url: string | null;
}>;

export type CreemPortalSession = Readonly<{
  url: string | null;
}>;

type CreemWebhookPayload = Readonly<{
  id?: string;
  eventType?: string;
  created_at?: number;
  object?: Readonly<Record<string, unknown>>;
}>;

/**
 * Third supported billing provider (Merchant of Record — Stripe alternative
 * with lower fees). Shares the framework-neutral BFF contract with the Stripe
 * and Lemon Squeezy adapters: same request/verification types, same ledger.
 */
export class CreemBillingAdapter {
  constructor(private readonly client: CreemBillingClient) {}

  async createCheckoutSession(input: StripeCheckoutRequest): Promise<StripeCheckoutSession> {
    const session = await this.client.createCheckout({
      ...(input.customerEmail === undefined ? {} : { customerEmail: input.customerEmail }),
      metadata: {
        entitlement: input.entitlement,
        priceId: input.priceId,
        workspaceId: input.workspaceId,
      },
      productId: input.priceId,
      requestId: input.idempotencyKey,
      successUrl: input.successUrl,
      units:
        input.seats !== undefined &&
        Number.isInteger(input.seats) &&
        input.seats >= 1 &&
        input.seats <= 999
          ? input.seats
          : 1,
    });

    return { id: session.id, url: session.url };
  }

  async createPortalSession(input: StripePortalRequest): Promise<StripePortalSession> {
    const portal = await this.client.customerPortalLink(input.customerId);
    if (portal.url === null) {
      throw new Error("Creem did not return a customer portal URL.");
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

    let parsed: CreemWebhookPayload;
    try {
      const value: unknown = JSON.parse(input.payload);
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { verification: "rejected" };
      }
      parsed = value;
    } catch {
      return { verification: "rejected" };
    }

    const eventType = parsed.eventType;
    const object = parsed.object;
    if (eventType === undefined || object === undefined || parsed.id === undefined) {
      return { verification: "rejected" };
    }

    const metadata = recordValue(object.metadata);
    const customerId = creemCustomerId(object);
    const subscriptionId = creemSubscriptionId(object);
    const priceId = creemPriceId(object) ?? stringValue(metadata?.priceId);
    const occurredAt =
      typeof parsed.created_at === "number" && Number.isSafeInteger(parsed.created_at)
        ? new Date(parsed.created_at)
        : new Date(0);

    const event: VerifiedStripeBillingEvent = {
      ...(customerId === undefined ? {} : { customerId }),
      ...(typeof metadata?.entitlement === "string" ? { entitlement: metadata.entitlement } : {}),
      entitlementStatus: creemEntitlementStatus(eventType, object.status),
      eventId: parsed.id,
      eventType,
      occurredAt,
      ...(priceId === undefined ? {} : { priceId }),
      ...(subscriptionId === undefined ? {} : { subscriptionId }),
      ...(typeof metadata?.workspaceId === "string" ? { workspaceId: metadata.workspaceId } : {}),
    };

    return { event, verification: "verified" };
  }
}

function recordValue(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function creemPriceId(object: Readonly<Record<string, unknown>>): string | undefined {
  const product = recordValue(object.product);
  const price = recordValue(object.price);
  return (
    stringValue(object.product_id) ??
    stringValue(object.productId) ??
    stringValue(product?.id) ??
    stringValue(object.price_id) ??
    stringValue(object.priceId) ??
    stringValue(price?.id)
  );
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  return undefined;
}

/** Customer id arrives as `object.customer` (id string) or `object.customer.id`. */
function creemCustomerId(object: Readonly<Record<string, unknown>>): string | undefined {
  const customer = object.customer;
  if (typeof customer === "string") {
    return customer;
  }
  const record = recordValue(customer);
  if (typeof record?.id === "string") {
    return record.id;
  }
  const order = recordValue(object.order);
  return typeof order?.customer === "string" ? order.customer : undefined;
}

function creemSubscriptionId(object: Readonly<Record<string, unknown>>): string | undefined {
  if (object.object === "subscription" && typeof object.id === "string") {
    return object.id;
  }
  const subscription = recordValue(object.subscription);
  return typeof subscription?.id === "string" ? subscription.id : undefined;
}

function creemEntitlementStatus(
  eventType: string,
  subscriptionStatus: unknown,
): StripeEntitlementStatus | null {
  // checkout.completed is Creem's primary grant trigger (payment confirmed).
  if (eventType === "checkout.completed" || eventType === "subscription.paid") {
    return "active";
  }
  if (eventType === "subscription.past_due" || eventType === "subscription.unpaid") {
    return "past_due";
  }
  if (
    eventType === "subscription.canceled" ||
    eventType === "subscription.expired" ||
    eventType === "subscription.paused" ||
    eventType === "refund.created"
  ) {
    return "inactive";
  }
  // scheduled_cancel keeps access until period end; dispute.created is undecided.
  if (
    eventType === "subscription.active" ||
    eventType === "subscription.trialing" ||
    eventType === "subscription.update"
  ) {
    switch (subscriptionStatus) {
      case "active":
        return "active";
      case "trialing":
        return "trialing";
      case "past_due":
      case "unpaid":
        return "past_due";
      case "canceled":
      case "expired":
      case "paused":
        return "inactive";
      default:
        return eventType === "subscription.trialing" ? "trialing" : null;
    }
  }
  return null;
}
