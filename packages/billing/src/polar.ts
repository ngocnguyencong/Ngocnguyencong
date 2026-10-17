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
import { decodeStandardWebhookSignature } from "./standard-webhooks";

/**
 * Minimal server-side Polar surface. Construct the SDK-backed client in the
 * application composition root; credentials never live here.
 */
export interface PolarBillingClient {
  createCheckout(input: PolarCheckoutCreateInput): Promise<PolarCheckoutSession>;
  createCustomerSession(input: PolarCustomerSessionInput): Promise<PolarPortalSession>;
  /**
   * `validateEvent` from `@polar-sh/sdk/webhooks` — throws on a bad Standard
   * Webhooks signature, otherwise returns the typed `{ type, timestamp, data }`
   * payload.
   */
  validateWebhook(body: string, headers: Readonly<Record<string, string>>, secret: string): unknown;
}

export type PolarCheckoutCreateInput = Readonly<{
  products: readonly string[];
  metadata: Readonly<Record<string, string>>;
  successUrl: string;
  customerEmail?: string;
  externalCustomerId?: string;
  seats?: number;
}>;

export type PolarCheckoutSession = Readonly<{
  id: string;
  url: string | null;
}>;

export type PolarCustomerSessionInput = Readonly<{
  customerId: string;
}>;

export type PolarPortalSession = Readonly<{
  url: string | null;
}>;

/**
 * Polar adapter (Merchant of Record). Shares the framework-neutral BFF contract
 * with the other providers: same request/verification types, same ledger.
 * Polar delivers Standard Webhooks; the three signing headers travel inside the
 * single `signature` field via `encodeStandardWebhookSignature`.
 */
export class PolarBillingAdapter {
  constructor(private readonly client: PolarBillingClient) {}

  async createCheckoutSession(input: StripeCheckoutRequest): Promise<StripeCheckoutSession> {
    const session = await this.client.createCheckout({
      ...(input.customerEmail === undefined ? {} : { customerEmail: input.customerEmail }),
      externalCustomerId: input.workspaceId,
      metadata: {
        entitlement: input.entitlement,
        priceId: input.priceId,
        workspaceId: input.workspaceId,
      },
      products: [input.priceId],
      successUrl: input.successUrl,
      // Polar `seats` only applies to seat-based products; Polar rejects other
      // product types, so it is forwarded untouched and documented as optional.
      ...(input.seats !== undefined &&
      Number.isInteger(input.seats) &&
      input.seats >= 1 &&
      input.seats <= 999
        ? { seats: input.seats }
        : {}),
    });

    return { id: session.id, url: session.url };
  }

  async createPortalSession(input: StripePortalRequest): Promise<StripePortalSession> {
    const session = await this.client.createCustomerSession({ customerId: input.customerId });
    if (session.url === null) {
      throw new Error("Polar did not return a customer portal URL.");
    }
    return { url: session.url };
  }

  verifySignedWebhook(input: SignedStripeWebhookRequest): SignedStripeWebhookVerification {
    const headers = decodeStandardWebhookSignature(input.signature);
    if (headers === null) {
      return { verification: "rejected" };
    }

    let payload: unknown;
    try {
      payload = this.client.validateWebhook(input.payload, headers, input.webhookSecret);
    } catch {
      return { verification: "rejected" };
    }

    const event = recordValue(payload);
    const data = recordValue(event?.data);
    const eventType = event?.type;
    if (event === undefined || data === undefined || typeof eventType !== "string") {
      return { verification: "rejected" };
    }

    const metadata = recordValue(data.metadata);
    const customerId = typeof data.customerId === "string" ? data.customerId : undefined;
    const subscriptionId =
      typeof data.subscriptionId === "string"
        ? data.subscriptionId
        : eventType.startsWith("subscription.")
          ? stringValue(data.id)
          : undefined;
    const priceId = polarPriceId(data) ?? stringValue(metadata?.priceId);

    const verified: VerifiedStripeBillingEvent = {
      ...(customerId === undefined ? {} : { customerId }),
      ...(typeof metadata?.entitlement === "string" ? { entitlement: metadata.entitlement } : {}),
      entitlementStatus: polarEntitlementStatus(eventType, data.status),
      eventId: headers["webhook-id"] as string,
      eventType,
      occurredAt: occurredAtFrom(event?.timestamp),
      ...(priceId === undefined ? {} : { priceId }),
      ...(subscriptionId === undefined ? {} : { subscriptionId }),
      ...(typeof metadata?.workspaceId === "string" ? { workspaceId: metadata.workspaceId } : {}),
    };

    return { event: verified, verification: "verified" };
  }
}

function recordValue(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function polarPriceId(data: Readonly<Record<string, unknown>>): string | undefined {
  const product = recordValue(data.product);
  const price = recordValue(data.price);
  return (
    stringValue(data.productId) ??
    stringValue(data.product_id) ??
    stringValue(product?.id) ??
    stringValue(data.priceId) ??
    stringValue(data.price_id) ??
    stringValue(price?.id)
  );
}

function occurredAtFrom(timestamp: unknown): Date {
  if (timestamp instanceof Date && !Number.isNaN(timestamp.getTime())) {
    return timestamp;
  }
  if (typeof timestamp === "string") {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date(0);
}

function polarEntitlementStatus(
  eventType: string,
  subscriptionStatus: unknown,
): StripeEntitlementStatus | null {
  // order.paid is Polar's primary grant trigger (payment confirmed).
  if (
    eventType === "order.paid" ||
    eventType === "subscription.active" ||
    eventType === "subscription.uncanceled"
  ) {
    return "active";
  }
  if (eventType === "subscription.past_due") {
    return "past_due";
  }
  if (
    eventType === "subscription.canceled" ||
    eventType === "subscription.revoked" ||
    eventType === "order.refunded" ||
    eventType === "refund.created"
  ) {
    return "inactive";
  }
  // subscription.created/updated carry a status; map like the other providers.
  if (eventType === "subscription.created" || eventType === "subscription.updated") {
    switch (subscriptionStatus) {
      case "active":
        return "active";
      case "trialing":
        return "trialing";
      case "past_due":
      case "unpaid":
        return "past_due";
      case "canceled":
      case "incomplete_expired":
      case "paused":
        return "inactive";
      default:
        return null;
    }
  }
  return null;
}
