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

/** Documented customer self-service page for managing Whop memberships. */
export const WHOP_MEMBERSHIP_MANAGE_URL = "https://whop.com/@me/settings/memberships";

/**
 * Minimal server-side Whop surface. Construct the SDK-backed client in the
 * application composition root; credentials never live here.
 */
export interface WhopBillingClient {
  createCheckoutConfiguration(
    input: WhopCheckoutConfigurationCreateInput,
  ): Promise<WhopCheckoutSession>;
  /**
   * `memberships.retrieve` — Whop has no portal-session API; the per-membership
   * `manage_url` is the customer self-service link (`null` when the API omits
   * it, in which case the adapter falls back to the documented static page).
   */
  retrieveMembership(membershipId: string): Promise<WhopMembership>;
  /**
   * `unwrapWebhook` from `@whop/sdk/helpers` — throws on a bad Standard
   * Webhooks signature, otherwise returns the parsed `{ type, data }` body.
   */
  unwrapWebhook(body: string, headers: Readonly<Record<string, string>>, secret: string): unknown;
}

export type WhopCheckoutConfigurationCreateInput = Readonly<{
  planId: string;
  metadata: Readonly<Record<string, string>>;
  redirectUrl: string;
}>;

export type WhopCheckoutSession = Readonly<{
  id: string;
  url: string | null;
}>;

export type WhopMembership = Readonly<{
  manageUrl: string | null;
}>;

/**
 * Whop adapter. Shares the framework-neutral BFF contract with the other
 * providers: same request/verification types, same ledger. The membership id
 * (`mem_`) plays the combined customer/subscription role — it is stored as the
 * provider customer id so the portal can retrieve the membership's manage_url.
 * Standard Webhooks headers travel inside the single `signature` field via
 * `encodeStandardWebhookSignature`.
 */
export class WhopBillingAdapter {
  constructor(private readonly client: WhopBillingClient) {}

  async createCheckoutSession(input: StripeCheckoutRequest): Promise<StripeCheckoutSession> {
    const session = await this.client.createCheckoutConfiguration({
      metadata: {
        entitlement: input.entitlement,
        priceId: input.priceId,
        workspaceId: input.workspaceId,
      },
      planId: input.priceId,
      redirectUrl: input.successUrl,
      // Whop checkout configurations have no seat/quantity input; seat counts
      // are ignored for this provider (documented deviation).
    });

    return { id: session.id, url: session.url };
  }

  async createPortalSession(input: StripePortalRequest): Promise<StripePortalSession> {
    const membership = await this.client.retrieveMembership(input.customerId);
    return { url: membership.manageUrl ?? WHOP_MEMBERSHIP_MANAGE_URL };
  }

  verifySignedWebhook(input: SignedStripeWebhookRequest): SignedStripeWebhookVerification {
    const headers = decodeStandardWebhookSignature(input.signature);
    if (headers === null) {
      return { verification: "rejected" };
    }

    let payload: unknown;
    try {
      payload = this.client.unwrapWebhook(input.payload, headers, input.webhookSecret);
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
    // The membership id is Whop's billing entity: it identifies the buyer's
    // access grant and is required to retrieve the portal manage_url.
    const membershipId =
      stringValue(data.membership_id) ??
      (eventType.startsWith("membership.") ? stringValue(data.id) : undefined);
    const occurredAt = occurredAtFrom(event?.timestamp);
    const eventId =
      stringValue(event?.id) ?? headers["webhook-id"] ?? `${eventType}:${occurredAt.getTime()}`;
    const priceId = whopPriceId(data) ?? stringValue(metadata?.priceId);

    const verified: VerifiedStripeBillingEvent = {
      ...(membershipId === undefined ? {} : { customerId: membershipId }),
      ...(typeof metadata?.entitlement === "string" ? { entitlement: metadata.entitlement } : {}),
      entitlementStatus: whopEntitlementStatus(eventType, data.status),
      eventId,
      eventType,
      occurredAt,
      ...(priceId === undefined ? {} : { priceId }),
      ...(membershipId === undefined ? {} : { subscriptionId: membershipId }),
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

function whopPriceId(data: Readonly<Record<string, unknown>>): string | undefined {
  const plan = recordValue(data.plan);
  return (
    stringValue(data.plan_id) ??
    stringValue(data.planId) ??
    stringValue(plan?.id) ??
    stringValue(data.product_id) ??
    stringValue(data.productId)
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

function whopEntitlementStatus(
  eventType: string,
  membershipStatus: unknown,
): StripeEntitlementStatus | null {
  // payment.succeeded is Whop's primary grant trigger; membership.activated
  // confirms access. A completed one-time membership also grants access.
  if (eventType === "payment.succeeded" || eventType === "invoice.paid") {
    return "active";
  }
  if (eventType === "payment.failed" || eventType === "invoice.past_due") {
    return "past_due";
  }
  if (eventType === "membership.activated") {
    return "active";
  }
  if (eventType === "membership.deactivated" || eventType === "refund.created") {
    return "inactive";
  }
  // membership.cancel_at_period_end_changed keeps access until period end —
  // like the other providers' scheduled-cancel events, it is recorded but
  // does not change the entitlement.
  if (eventType === "membership.cancel_at_period_end_changed") {
    return null;
  }
  // membership.updated-style events are not emitted by Whop; guard on status
  // anyway for forward compatibility with future membership lifecycle events.
  if (eventType.startsWith("membership.")) {
    switch (membershipStatus) {
      case "active":
        return "active";
      case "trialing":
        return "trialing";
      case "past_due":
      case "unresolved":
        return "past_due";
      case "canceled":
      case "expired":
        return "inactive";
      case "completed":
        return "active";
      default:
        return null;
    }
  }
  return null;
}
