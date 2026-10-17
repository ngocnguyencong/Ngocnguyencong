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
 * Minimal server-side Paddle HTTP surface. Construct the fetch-backed client in
 * the application composition root; credentials never live here.
 */
export interface PaddleBillingClient {
  createTransaction(input: PaddleTransactionCreateInput): Promise<PaddleCheckoutSession>;
  createCustomerPortalSession(
    input: PaddleCustomerPortalSessionInput,
  ): Promise<PaddlePortalSession>;
}

export type PaddleTransactionCreateInput = Readonly<{
  items: ReadonlyArray<Readonly<{ priceId: string; quantity: number }>>;
  customData: Readonly<Record<string, string>>;
  customerEmail?: string;
}>;

export type PaddleCheckoutSession = Readonly<{
  id: string;
  url: string | null;
}>;

export type PaddleCustomerPortalSessionInput = Readonly<{
  customerId: string;
}>;

export type PaddlePortalSession = Readonly<{
  url: string | null;
}>;

type PaddleWebhookPayload = Readonly<{
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  notification_id?: string;
  data?: Readonly<Record<string, unknown>>;
}>;

/**
 * Paddle adapter (Merchant of Record). Shares the framework-neutral BFF
 * contract with the other providers: same request/verification types, same
 * ledger. The `Paddle-Signature` header (`ts=…;h1=…`) travels in the single
 * `signature` field — no packing needed since it is already one header.
 */
export class PaddleBillingAdapter {
  constructor(private readonly client: PaddleBillingClient) {}

  async createCheckoutSession(input: StripeCheckoutRequest): Promise<StripeCheckoutSession> {
    const session = await this.client.createTransaction({
      customData: {
        entitlement: input.entitlement,
        priceId: input.priceId,
        workspaceId: input.workspaceId,
      },
      ...(input.customerEmail === undefined ? {} : { customerEmail: input.customerEmail }),
      items: [
        {
          priceId: input.priceId,
          quantity:
            input.seats !== undefined &&
            Number.isInteger(input.seats) &&
            input.seats >= 1 &&
            input.seats <= 999
              ? input.seats
              : 1,
        },
      ],
      // Paddle checkouts redirect per the seller's checkout settings — there is
      // no per-transaction success-url field, so input.successUrl is
      // intentionally not forwarded (documented deviation).
    });

    return { id: session.id, url: session.url };
  }

  async createPortalSession(input: StripePortalRequest): Promise<StripePortalSession> {
    const portal = await this.client.createCustomerPortalSession({
      customerId: input.customerId,
    });
    if (portal.url === null) {
      throw new Error("Paddle did not return a customer portal URL.");
    }
    return { url: portal.url };
  }

  verifySignedWebhook(input: SignedStripeWebhookRequest): SignedStripeWebhookVerification {
    const signature = parsePaddleSignature(input.signature);
    if (signature === null) {
      return { verification: "rejected" };
    }

    const expected = createHmac("sha256", input.webhookSecret)
      .update(`${signature.timestamp}:${input.payload}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expected, "utf8");
    const signatureMatches = signature.candidates.some(
      (candidate) =>
        candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer),
    );
    if (!signatureMatches) {
      return { verification: "rejected" };
    }

    let parsed: PaddleWebhookPayload;
    try {
      const value: unknown = JSON.parse(input.payload);
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { verification: "rejected" };
      }
      parsed = value;
    } catch {
      return { verification: "rejected" };
    }

    const eventType = parsed.event_type;
    const data = parsed.data;
    if (eventType === undefined || data === undefined || parsed.event_id === undefined) {
      return { verification: "rejected" };
    }

    const customData = recordValue(data.custom_data);
    const customerId = stringValue(data.customer_id);
    // subscription.* events carry the subscription id as `id`; transaction.*
    // events carry `subscription_id` (absent for one-time purchases, where the
    // transaction id is the stable billing entity); adjustments reference the
    // transaction they adjust.
    const subscriptionId =
      stringValue(data.subscription_id) ??
      (eventType.startsWith("subscription.") || eventType.startsWith("transaction.")
        ? stringValue(data.id)
        : undefined) ??
      stringValue(data.transaction_id);
    const occurredAt = parseTimestamp(parsed.occurred_at) ?? new Date(0);

    const event: VerifiedStripeBillingEvent = {
      ...(customerId === undefined ? {} : { customerId }),
      ...(typeof customData?.entitlement === "string"
        ? { entitlement: customData.entitlement }
        : {}),
      entitlementStatus: paddleEntitlementStatus(eventType, data.status, data.action),
      eventId: parsed.event_id,
      eventType,
      occurredAt,
      ...(typeof customData?.priceId === "string" ? { priceId: customData.priceId } : {}),
      ...(subscriptionId === undefined ? {} : { subscriptionId }),
      ...(typeof customData?.workspaceId === "string"
        ? { workspaceId: customData.workspaceId }
        : {}),
    };

    return { event, verification: "verified" };
  }
}

/** `Paddle-Signature` is `ts=<unix-seconds>;h1=<hex>` (additional `h1` parts allowed). */
function parsePaddleSignature(
  signature: string,
): Readonly<{ timestamp: string; candidates: Buffer[] }> | null {
  let timestamp: string | null = null;
  const candidates: Buffer[] = [];

  for (const part of signature.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "ts" && /^\d+$/.test(value)) {
      timestamp = value;
    }
    if (key === "h1" && /^[a-fA-F0-9]{64}$/.test(value)) {
      candidates.push(Buffer.from(value.toLowerCase(), "utf8"));
    }
  }

  if (timestamp === null || candidates.length === 0) {
    return null;
  }
  return { timestamp, candidates };
}

function recordValue(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function paddleEntitlementStatus(
  eventType: string,
  status: unknown,
  action: unknown,
): StripeEntitlementStatus | null {
  // transaction.completed is Paddle's primary grant trigger (payment confirmed).
  if (eventType === "transaction.completed" || eventType === "transaction.paid") {
    return "active";
  }
  if (eventType === "transaction.payment_failed" || eventType === "transaction.past_due") {
    return "past_due";
  }
  // Refunds and chargebacks arrive as adjustments; only an approved adjustment
  // moves money back, so pending/rejected ones never touch the entitlement.
  if (
    (eventType === "adjustment.updated" || eventType === "adjustment.created") &&
    (action === "refund" || action === "credit_refund" || action === "chargeback") &&
    status === "approved"
  ) {
    return "inactive";
  }
  if (eventType.startsWith("subscription.")) {
    // subscription.canceled/paused carry a terminal status already; created,
    // updated, activated, resumed, trialing and imported all sync on status.
    switch (status) {
      case "active":
        return "active";
      case "trialing":
        return "trialing";
      case "past_due":
        return "past_due";
      case "paused":
      case "canceled":
        return "inactive";
      default:
        return eventType === "subscription.canceled" || eventType === "subscription.paused"
          ? "inactive"
          : null;
    }
  }
  return null;
}
