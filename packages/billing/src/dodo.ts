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
import { decodeStandardWebhookSignature } from "./standard-webhooks";

/** Standard Webhooks replay tolerance, matching the spec's default. */
const DODO_TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Minimal server-side Dodo Payments HTTP surface. Construct the fetch-backed
 * client in the application composition root; credentials never live here.
 */
export interface DodoBillingClient {
  createCheckout(input: DodoCheckoutCreateInput): Promise<DodoCheckoutSession>;
  createCustomerPortalLink(customerId: string, returnUrl?: string): Promise<DodoPortalSession>;
}

export type DodoCheckoutCreateInput = Readonly<{
  productId: string;
  quantity: number;
  returnUrl: string;
  customerEmail?: string;
  metadata: Readonly<Record<string, string>>;
}>;

export type DodoCheckoutSession = Readonly<{
  id: string;
  url: string | null;
}>;

export type DodoPortalSession = Readonly<{
  url: string | null;
}>;

/**
 * Dodo Payments adapter (Merchant of Record). Shares the framework-neutral BFF
 * contract with the other providers: same request/verification types, same
 * ledger. Dodo delivers Standard Webhooks; the three signing headers travel
 * inside the single `signature` field via `decodeStandardWebhookSignature` —
 * verified locally (no SDK) since it is a plain HMAC-SHA256/base64 scheme.
 */
export class DodoBillingAdapter {
  constructor(private readonly client: DodoBillingClient) {}

  async createCheckoutSession(input: StripeCheckoutRequest): Promise<StripeCheckoutSession> {
    const session = await this.client.createCheckout({
      ...(input.customerEmail === undefined ? {} : { customerEmail: input.customerEmail }),
      metadata: {
        entitlement: input.entitlement,
        priceId: input.priceId,
        workspaceId: input.workspaceId,
      },
      productId: input.priceId,
      quantity:
        input.seats !== undefined &&
        Number.isInteger(input.seats) &&
        input.seats >= 1 &&
        input.seats <= 999
          ? input.seats
          : 1,
      returnUrl: input.successUrl,
    });

    return { id: session.id, url: session.url };
  }

  async createPortalSession(input: StripePortalRequest): Promise<StripePortalSession> {
    const portal = await this.client.createCustomerPortalLink(input.customerId, input.returnUrl);
    if (portal.url === null) {
      throw new Error("Dodo Payments did not return a customer portal URL.");
    }
    return { url: portal.url };
  }

  verifySignedWebhook(input: SignedStripeWebhookRequest): SignedStripeWebhookVerification {
    const headers = decodeStandardWebhookSignature(input.signature);
    if (headers === null) {
      return { verification: "rejected" };
    }

    const webhookId = headers["webhook-id"];
    const webhookTimestamp = headers["webhook-timestamp"];
    const webhookSignatureHeader = headers["webhook-signature"];
    if (
      webhookId === undefined ||
      webhookTimestamp === undefined ||
      webhookSignatureHeader === undefined
    ) {
      return { verification: "rejected" };
    }

    const timestampSeconds = Number.parseInt(webhookTimestamp, 10);
    if (
      !Number.isSafeInteger(timestampSeconds) ||
      Math.abs(Date.now() / 1000 - timestampSeconds) > DODO_TIMESTAMP_TOLERANCE_SECONDS
    ) {
      return { verification: "rejected" };
    }

    const signedContent = `${webhookId}.${webhookTimestamp}.${input.payload}`;
    const expected = createHmac("sha256", dodoWebhookSecretBytes(input.webhookSecret))
      .update(signedContent)
      .digest("base64");
    const expectedToken = Buffer.from(`v1,${expected}`, "utf8");
    const signatureMatches = webhookSignatureHeader
      .split(" ")
      .filter((token) => token.startsWith("v1,"))
      .some((token) => {
        const candidate = Buffer.from(token, "utf8");
        return (
          candidate.length === expectedToken.length && timingSafeEqual(candidate, expectedToken)
        );
      });
    if (!signatureMatches) {
      return { verification: "rejected" };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(input.payload);
    } catch {
      return { verification: "rejected" };
    }

    const event = recordValue(parsed);
    const data = recordValue(event?.data);
    const eventType = event?.type;
    if (event === undefined || data === undefined || typeof eventType !== "string") {
      return { verification: "rejected" };
    }

    const metadata = recordValue(data.metadata);
    const customer = recordValue(data.customer);
    const customerId = stringValue(data.customer_id) ?? stringValue(customer?.customer_id);
    // subscription.* events carry the subscription id as `subscription_id`;
    // payment.* events carry it when the charge belongs to a subscription and
    // otherwise fall back to the payment id as the stable billing entity.
    const subscriptionId =
      stringValue(data.subscription_id) ??
      (eventType.startsWith("payment.") ? stringValue(data.payment_id) : undefined) ??
      stringValue(data.id);
    const occurredAt = parseTimestamp(event.timestamp) ?? new Date(timestampSeconds * 1_000);

    const verified: VerifiedStripeBillingEvent = {
      ...(customerId === undefined ? {} : { customerId }),
      ...(typeof metadata?.entitlement === "string" ? { entitlement: metadata.entitlement } : {}),
      entitlementStatus: dodoEntitlementStatus(eventType, data.status),
      eventId: webhookId,
      eventType,
      occurredAt,
      ...(typeof metadata?.priceId === "string" ? { priceId: metadata.priceId } : {}),
      ...(subscriptionId === undefined ? {} : { subscriptionId }),
      ...(typeof metadata?.workspaceId === "string" ? { workspaceId: metadata.workspaceId } : {}),
    };

    return { event: verified, verification: "verified" };
  }
}

/** `whsec_`-prefixed secrets are base64-encoded Standard Webhooks keys. */
function dodoWebhookSecretBytes(secret: string): Buffer {
  if (secret.startsWith("whsec_")) {
    const decoded = Buffer.from(secret.slice("whsec_".length), "base64");
    if (decoded.length > 0) {
      return decoded;
    }
  }
  return Buffer.from(secret, "utf8");
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

function dodoEntitlementStatus(eventType: string, status: unknown): StripeEntitlementStatus | null {
  // payment.succeeded is Dodo's payment-confirmation grant trigger.
  if (eventType === "payment.succeeded") {
    return "active";
  }
  if (eventType === "payment.failed") {
    return "past_due";
  }
  if (
    eventType === "subscription.active" ||
    eventType === "subscription.renewed" ||
    eventType === "subscription.unpaused"
  ) {
    return "active";
  }
  if (eventType === "subscription.on_hold" || eventType === "subscription.failed") {
    return "past_due";
  }
  if (
    eventType === "subscription.cancelled" ||
    eventType === "subscription.expired" ||
    eventType === "subscription.paused" ||
    eventType === "refund.succeeded" ||
    eventType === "dispute.lost"
  ) {
    return "inactive";
  }
  // subscription.updated/plan_changed fire on any field change — sync on status.
  if (eventType.startsWith("subscription.")) {
    switch (status) {
      case "active":
        return "active";
      case "trialing":
        return "trialing";
      case "on_hold":
      case "failed":
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
