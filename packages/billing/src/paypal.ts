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
 * PayPal delivers five webhook verification headers; the framework-neutral
 * `SignedStripeWebhookRequest` contract carries a single `signature` string, so
 * routes pack them with {@link encodePaypalWebhookSignature} and the adapter
 * recovers them with {@link decodePaypalWebhookSignature}.
 */
export const PAYPAL_WEBHOOK_SIGNATURE_HEADERS = [
  "paypal-auth-algo",
  "paypal-cert-url",
  "paypal-transmission-id",
  "paypal-transmission-sig",
  "paypal-transmission-time",
] as const;

export type PaypalWebhookHeaders = Readonly<Record<string, string>>;

/** Pack the five PayPal verification headers into the single `signature` field. */
export function encodePaypalWebhookSignature(headers: PaypalWebhookHeaders): string {
  return JSON.stringify(
    Object.fromEntries(PAYPAL_WEBHOOK_SIGNATURE_HEADERS.map((name) => [name, headers[name] ?? ""])),
  );
}

/** Recover the headers packed by {@link encodePaypalWebhookSignature}. */
export function decodePaypalWebhookSignature(signature: string): PaypalWebhookHeaders | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(signature);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const headers: Record<string, string> = {};
  for (const name of PAYPAL_WEBHOOK_SIGNATURE_HEADERS) {
    const value = (parsed as Record<string, unknown>)[name];
    if (typeof value !== "string" || value.trim() === "") {
      return null;
    }
    headers[name] = value;
  }

  return headers;
}

/**
 * Minimal server-side PayPal surface. Construct the OAuth-backed fetch client
 * in the application composition root; credentials never live here.
 */
export interface PaypalBillingClient {
  createSubscription(input: PaypalSubscriptionCreateInput): Promise<PaypalCheckoutSession>;
  subscriptionPortalUrl(subscriptionId: string): Promise<PaypalPortalSession>;
  /**
   * `POST /v1/notifications/verify-webhook-signature` — PayPal signatures cannot
   * be verified locally (they chain to a hosted cert), so verification is a
   * server call returning `verification_status`.
   */
  verifyWebhookSignature(input: PaypalWebhookVerificationInput): Promise<PaypalWebhookVerification>;
}

export type PaypalSubscriptionCreateInput = Readonly<{
  planId: string;
  customId: string;
  returnUrl: string;
  cancelUrl: string;
  subscriberEmail?: string;
}>;

export type PaypalCheckoutSession = Readonly<{
  id: string;
  url: string | null;
}>;

export type PaypalPortalSession = Readonly<{
  url: string | null;
}>;

export type PaypalWebhookVerificationInput = Readonly<{
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookId: string;
  webhookEvent: unknown;
}>;

export type PaypalWebhookVerification = Readonly<{
  verificationStatus: string;
}>;

/** PayPal `custom_id` echoes back on every webhook resource (max 127 chars). */
const PAYPAL_CUSTOM_ID_MAX_LENGTH = 127;

/**
 * PayPal adapter. Shares the framework-neutral BFF contract with the other
 * providers: same request/verification types, same ledger. PayPal has no local
 * signature scheme or hosted portal — `verifySignedWebhook` is async (the BFF
 * awaits it) and the portal resolves to PayPal's autopay self-service page.
 */
export class PaypalBillingAdapter {
  constructor(private readonly client: PaypalBillingClient) {}

  async createCheckoutSession(input: StripeCheckoutRequest): Promise<StripeCheckoutSession> {
    const customId = JSON.stringify({
      e: input.entitlement,
      p: input.priceId,
      w: input.workspaceId,
    });
    if (customId.length > PAYPAL_CUSTOM_ID_MAX_LENGTH) {
      throw new Error("PayPal custom_id exceeds the 127-character limit.");
    }

    const session = await this.client.createSubscription({
      cancelUrl: input.cancelUrl,
      customId,
      planId: input.priceId,
      returnUrl: input.successUrl,
      ...(input.customerEmail === undefined ? {} : { subscriberEmail: input.customerEmail }),
      // PayPal subscriptions are always per-subscriber — no seat/quantity input;
      // seat counts are ignored for this provider (documented deviation), as is
      // customerId (PayPal cannot pre-select a saved payer on a new subscription).
    });

    return { id: session.id, url: session.url };
  }

  async createPortalSession(input: StripePortalRequest): Promise<StripePortalSession> {
    const portal = await this.client.subscriptionPortalUrl(input.customerId);
    if (portal.url === null) {
      throw new Error("PayPal did not return a subscription portal URL.");
    }
    return { url: portal.url };
  }

  async verifySignedWebhook(
    input: SignedStripeWebhookRequest,
  ): Promise<SignedStripeWebhookVerification> {
    const headers = decodePaypalWebhookSignature(input.signature);
    if (headers === null) {
      return { verification: "rejected" };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(input.payload);
    } catch {
      return { verification: "rejected" };
    }

    const event = recordValue(parsed);
    const resource = recordValue(event?.resource);
    const eventType = event?.event_type;
    if (
      event === undefined ||
      resource === undefined ||
      typeof eventType !== "string" ||
      typeof event.id !== "string"
    ) {
      return { verification: "rejected" };
    }

    const authAlgo = headers["paypal-auth-algo"];
    const certUrl = headers["paypal-cert-url"];
    const transmissionId = headers["paypal-transmission-id"];
    const transmissionSig = headers["paypal-transmission-sig"];
    const transmissionTime = headers["paypal-transmission-time"];
    if (
      authAlgo === undefined ||
      certUrl === undefined ||
      transmissionId === undefined ||
      transmissionSig === undefined ||
      transmissionTime === undefined
    ) {
      return { verification: "rejected" };
    }

    let verification: PaypalWebhookVerification;
    try {
      verification = await this.client.verifyWebhookSignature({
        authAlgo,
        certUrl,
        transmissionId,
        transmissionSig,
        transmissionTime,
        webhookEvent: parsed,
        // The webhook id configured in the PayPal app rides in the shared
        // `webhookSecret` contract slot.
        webhookId: input.webhookSecret,
      });
    } catch {
      return { verification: "rejected" };
    }
    if (verification.verificationStatus !== "SUCCESS") {
      return { verification: "rejected" };
    }

    const custom = paypalCustomData(resource.custom_id ?? resource.custom);
    const subscriber = recordValue(resource.subscriber);
    const payer = recordValue(resource.payer);
    // `BILLING.SUBSCRIPTION.*` resources carry the subscription id as `id`;
    // `PAYMENT.SALE.*` resources link the subscription via `billing_agreement_id`.
    const subscriptionId =
      stringValue(resource.billing_agreement_id) ??
      (eventType.startsWith("BILLING.SUBSCRIPTION.") ? stringValue(resource.id) : undefined) ??
      stringValue(resource.id);
    const customerId =
      stringValue(subscriber?.payer_id) ??
      stringValue(payer?.payer_id) ??
      // A billing identity must exist so the customer record unlocks the portal;
      // the subscription id plays that role when no payer id is present.
      subscriptionId;
    const occurredAt =
      parseTimestamp(resource.update_time) ??
      parseTimestamp(resource.create_time) ??
      parseTimestamp(event.create_time) ??
      new Date(0);

    const verified: VerifiedStripeBillingEvent = {
      ...(customerId === undefined ? {} : { customerId }),
      ...(custom.entitlement === undefined ? {} : { entitlement: custom.entitlement }),
      entitlementStatus: paypalEntitlementStatus(eventType, resource.status),
      eventId: event.id,
      eventType,
      occurredAt,
      ...(custom.priceId === undefined
        ? typeof resource.plan_id === "string"
          ? { priceId: resource.plan_id }
          : {}
        : { priceId: custom.priceId }),
      ...(subscriptionId === undefined ? {} : { subscriptionId }),
      ...(custom.workspaceId === undefined ? {} : { workspaceId: custom.workspaceId }),
    };

    return { event: verified, verification: "verified" };
  }
}

/** Decode the `custom_id` JSON the adapter writes at checkout (`{w,e,p}`). */
function paypalCustomData(value: unknown): {
  workspaceId?: string;
  entitlement?: string;
  priceId?: string;
} {
  if (typeof value !== "string" || value === "") {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);
    const record = recordValue(parsed);
    if (record === undefined) {
      return {};
    }
    return {
      ...(typeof record.w === "string" ? { workspaceId: record.w } : {}),
      ...(typeof record.e === "string" ? { entitlement: record.e } : {}),
      ...(typeof record.p === "string" ? { priceId: record.p } : {}),
    };
  } catch {
    // A non-JSON custom id is still a valid workspace reference — products that
    // write `workspaceId` directly keep working.
    return { workspaceId: value };
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

function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function paypalEntitlementStatus(
  eventType: string,
  status: unknown,
): StripeEntitlementStatus | null {
  // BILLING.SUBSCRIPTION.ACTIVATED is PayPal's primary grant trigger;
  // PAYMENT.SALE.COMPLETED confirms each renewal charge.
  if (
    eventType === "BILLING.SUBSCRIPTION.ACTIVATED" ||
    eventType === "BILLING.SUBSCRIPTION.RE-ACTIVATED" ||
    eventType === "PAYMENT.SALE.COMPLETED"
  ) {
    return "active";
  }
  if (
    eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED" ||
    eventType === "BILLING.SUBSCRIPTION.SUSPENDED"
  ) {
    return "past_due";
  }
  if (
    eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
    eventType === "BILLING.SUBSCRIPTION.EXPIRED" ||
    eventType === "PAYMENT.SALE.REFUNDED" ||
    eventType === "PAYMENT.SALE.REVERSED" ||
    eventType === "PAYMENT.SALE.DENIED"
  ) {
    return "inactive";
  }
  // CREATED/UPDATED carry a status; APPROVED* means the buyer approved but the
  // subscription is not billing-active yet — wait for ACTIVATED.
  if (
    eventType === "BILLING.SUBSCRIPTION.CREATED" ||
    eventType === "BILLING.SUBSCRIPTION.UPDATED"
  ) {
    switch (status) {
      case "ACTIVE":
        return "active";
      case "SUSPENDED":
        return "past_due";
      case "CANCELLED":
      case "EXPIRED":
        return "inactive";
      default:
        return null;
    }
  }
  return null;
}
