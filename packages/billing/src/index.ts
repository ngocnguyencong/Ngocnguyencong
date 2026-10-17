export {
  CreemBillingAdapter,
  type CreemBillingClient,
  type CreemCheckoutCreateInput,
  type CreemCheckoutSession,
  type CreemPortalSession,
} from "./creem";

export {
  DodoBillingAdapter,
  type DodoBillingClient,
  type DodoCheckoutCreateInput,
  type DodoCheckoutSession,
  type DodoPortalSession,
} from "./dodo";

export {
  LemonSqueezyBillingAdapter,
  type LemonSqueezyBillingClient,
  type LemonSqueezyCheckoutCreateInput,
  type LemonSqueezyCheckoutSession,
  type LemonSqueezyPortalSession,
} from "./lemonsqueezy";

export {
  PaddleBillingAdapter,
  type PaddleBillingClient,
  type PaddleCheckoutSession,
  type PaddleCustomerPortalSessionInput,
  type PaddlePortalSession,
  type PaddleTransactionCreateInput,
} from "./paddle";

export {
  PAYPAL_WEBHOOK_SIGNATURE_HEADERS,
  PaypalBillingAdapter,
  decodePaypalWebhookSignature,
  encodePaypalWebhookSignature,
  type PaypalBillingClient,
  type PaypalCheckoutSession,
  type PaypalPortalSession,
  type PaypalSubscriptionCreateInput,
  type PaypalWebhookVerification,
  type PaypalWebhookVerificationInput,
} from "./paypal";

export {
  PolarBillingAdapter,
  type PolarBillingClient,
  type PolarCheckoutCreateInput,
  type PolarCheckoutSession,
  type PolarCustomerSessionInput,
  type PolarPortalSession,
} from "./polar";

export {
  WHOP_MEMBERSHIP_MANAGE_URL,
  WhopBillingAdapter,
  type WhopBillingClient,
  type WhopCheckoutConfigurationCreateInput,
  type WhopCheckoutSession,
  type WhopMembership,
} from "./whop";

export {
  STANDARD_WEBHOOK_SIGNATURE_HEADERS,
  encodeStandardWebhookSignature,
} from "./standard-webhooks";

export type Entitlement = Readonly<{
  workspaceId: string;
  key: string;
  state: "active";
}>;

export type EntitlementInput = Readonly<{
  workspaceId: string;
  key: string;
}>;

export type WebhookMutation = Readonly<{
  type: "grant" | "revoke";
  entitlement: string;
}>;

export type WebhookEvent = Readonly<{
  workspaceId: string;
  id: string;
  verification: "verified" | "rejected";
  mutation: WebhookMutation;
}>;

export type WebhookProcessResult = Readonly<{
  disposition: "processed" | "duplicate" | "ignored" | "rejected";
}>;

export type StripeEntitlementStatus = "active" | "trialing" | "past_due" | "inactive";

export type VerifiedStripeBillingEvent = Readonly<{
  customerId?: string;
  entitlement?: string;
  entitlementStatus: StripeEntitlementStatus | null;
  eventId: string;
  eventType: string;
  occurredAt: Date;
  priceId?: string;
  subscriptionId?: string;
  workspaceId?: string;
}>;

export type SignedStripeWebhookVerification =
  | Readonly<{ verification: "rejected" }>
  | Readonly<{ event: VerifiedStripeBillingEvent; verification: "verified" }>;

export interface EntitlementService {
  grantEntitlement(input: EntitlementInput): Entitlement;
  revokeEntitlement(input: EntitlementInput): void;
  hasEntitlement(input: EntitlementInput): boolean;
}

export interface WebhookEventLedger {
  processWebhook(input: WebhookEvent): WebhookProcessResult;
  hasProcessedWebhook(input: Pick<WebhookEvent, "workspaceId" | "id">): boolean;
}

export type StripeCheckoutSessionCreateInput = Readonly<{
  mode: "subscription";
  custom_fields?: Array<
    Readonly<{
      key: string;
      label: Readonly<{ type: "custom"; custom: string }>;
      type: "text";
      optional: boolean;
    }>
  >;
  line_items: Array<Readonly<{ price: string; quantity: number }>>;
  success_url: string;
  cancel_url: string;
  client_reference_id: string;
  customer?: string;
  customer_email?: string;
  integration_identifier: string;
  metadata: Readonly<Record<string, string>>;
  subscription_data: Readonly<{
    metadata: Readonly<Record<string, string>>;
  }>;
}>;

export type StripeCheckoutSession = Readonly<{
  id: string;
  url: string | null;
}>;

export type StripePortalSessionCreateInput = Readonly<{
  customer: string;
  return_url: string;
}>;

export type StripePortalSession = Readonly<{
  url: string;
}>;

export type StripeWebhookEvent = Readonly<{
  created: number;
  id: string;
  type: string;
  data: Readonly<{
    object: Readonly<{
      metadata: Readonly<Record<string, string>> | null;
      customerId?: string;
      id?: string;
      items?: unknown;
      lines?: unknown;
      price?: unknown;
      paymentStatus?: string;
      status?: string;
      subscriptionId?: string;
    }>;
  }>;
}>;

/**
 * The minimum server-side Stripe SDK surface required by `StripeBillingAdapter`.
 * Construct the official Stripe client in an application composition root; never
 * place API keys or webhook secrets in this package.
 */
export interface StripeBillingClient {
  checkout: {
    sessions: {
      create(
        input: StripeCheckoutSessionCreateInput,
        options: Readonly<{ idempotencyKey: string }>,
      ): Promise<StripeCheckoutSession>;
    };
  };
  billingPortal: {
    sessions: {
      create(input: StripePortalSessionCreateInput): Promise<StripePortalSession>;
    };
  };
  webhooks: {
    constructEvent(payload: string, signature: string, secret: string): StripeWebhookEvent;
  };
}

export type StripeCheckoutRequest = Readonly<{
  workspaceId: string;
  entitlement: string;
  priceId: string;
  /** Per-seat quantity; 1 when omitted. */
  seats?: number;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  customerEmail?: string;
  idempotencyKey: string;
  integrationIdentifier: string;
}>;

export type StripePortalRequest = Readonly<{
  workspaceId: string;
  customerId: string;
  returnUrl: string;
}>;

export type SignedStripeWebhookRequest = Readonly<{
  payload: string;
  signature: string;
  webhookSecret: string;
}>;

/**
 * Server-side Stripe adapter. It owns request translation and delegates
 * entitlement mutation/idempotency to the existing workspace-scoped ledger.
 */
export class StripeBillingAdapter {
  constructor(private readonly client: StripeBillingClient) {}

  async createCheckoutSession(input: StripeCheckoutRequest): Promise<StripeCheckoutSession> {
    const metadata = {
      workspaceId: input.workspaceId,
      entitlement: input.entitlement,
      priceId: input.priceId,
    };

    return this.client.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [
          {
            price: input.priceId,
            quantity:
              input.seats !== undefined &&
              Number.isInteger(input.seats) &&
              input.seats >= 1 &&
              input.seats <= 999
                ? input.seats
                : 1,
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.workspaceId,
        ...(input.customerId === undefined ? {} : { customer: input.customerId }),
        ...(input.customerId === undefined && input.customerEmail !== undefined
          ? { customer_email: input.customerEmail }
          : {}),
        integration_identifier: input.integrationIdentifier,
        metadata,
        subscription_data: { metadata },
      },
      { idempotencyKey: input.idempotencyKey },
    );
  }

  async createPortalSession(input: StripePortalRequest): Promise<StripePortalSession> {
    return this.client.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
  }

  processSignedWebhook(
    input: SignedStripeWebhookRequest,
    ledger: WebhookEventLedger,
  ): WebhookProcessResult {
    const verification = this.verifySignedWebhook(input);
    if (verification.verification === "rejected") {
      return { disposition: "rejected" };
    }

    const { event } = verification;
    const workspaceId = event.workspaceId;
    const entitlement = event.entitlement;

    if (event.entitlementStatus === null) {
      return { disposition: "ignored" };
    }

    if (workspaceId === undefined || entitlement === undefined) {
      return { disposition: "rejected" };
    }

    return ledger.processWebhook({
      workspaceId,
      id: event.eventId,
      verification: "verified",
      mutation: {
        type:
          event.entitlementStatus === "active" || event.entitlementStatus === "trialing"
            ? "grant"
            : "revoke",
        entitlement,
      },
    });
  }

  verifySignedWebhook(input: SignedStripeWebhookRequest): SignedStripeWebhookVerification {
    let event: StripeWebhookEvent;

    try {
      event = this.client.webhooks.constructEvent(
        input.payload,
        input.signature,
        input.webhookSecret,
      );
    } catch {
      return { verification: "rejected" };
    }

    if (!Number.isSafeInteger(event.created) || event.created < 0) {
      return { verification: "rejected" };
    }

    const object = event.data.object;
    const metadata = object.metadata;
    const priceId = stripePriceId(object) ?? metadata?.priceId;
    const subscriptionId =
      object.subscriptionId ??
      (event.type.startsWith("customer.subscription.") ? object.id : undefined);

    return {
      event: {
        ...(object.customerId === undefined ? {} : { customerId: object.customerId }),
        ...(metadata?.entitlement === undefined ? {} : { entitlement: metadata.entitlement }),
        entitlementStatus: stripeEntitlementStatus(event.type, object.status, object.paymentStatus),
        eventId: event.id,
        eventType: event.type,
        occurredAt: new Date(event.created * 1_000),
        ...(priceId === undefined ? {} : { priceId }),
        ...(subscriptionId === undefined ? {} : { subscriptionId }),
        ...(metadata?.workspaceId === undefined ? {} : { workspaceId: metadata.workspaceId }),
      },
      verification: "verified",
    };
  }
}

function stripePriceId(object: StripeWebhookEvent["data"]["object"]): string | undefined {
  const record = object as Readonly<Record<string, unknown>>;
  const itemPrices = recordValue(record.items)?.data;
  if (Array.isArray(itemPrices)) {
    for (const item of itemPrices) {
      const priceId = referenceId(recordValue(item)?.price);
      if (priceId !== undefined) {
        return priceId;
      }
    }
  }

  const linePrices = recordValue(record.lines)?.data;
  if (Array.isArray(linePrices)) {
    for (const line of linePrices) {
      const priceId = referenceId(recordValue(line)?.price);
      if (priceId !== undefined) {
        return priceId;
      }
    }
  }

  return referenceId(record.price);
}

function recordValue(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function referenceId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  const id = recordValue(value)?.id;
  if (typeof id === "string" && id.trim().length > 0) {
    return id;
  }
  return undefined;
}

function stripeEntitlementStatus(
  eventType: string,
  subscriptionStatus: string | undefined,
  paymentStatus: string | undefined,
): StripeEntitlementStatus | null {
  if (eventType === "checkout.session.completed") {
    return paymentStatus === "unpaid" ? null : "active";
  }

  if (eventType === "checkout.session.async_payment_succeeded" || eventType === "invoice.paid") {
    return "active";
  }

  if (eventType === "invoice.payment_failed") {
    return "past_due";
  }

  if (
    eventType === "checkout.session.async_payment_failed" ||
    eventType === "customer.subscription.deleted"
  ) {
    return "inactive";
  }

  if (
    eventType === "customer.subscription.created" ||
    eventType === "customer.subscription.updated"
  ) {
    if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
      return subscriptionStatus;
    }

    if (subscriptionStatus === "past_due" || subscriptionStatus === "unpaid") {
      return "past_due";
    }

    return subscriptionStatus === undefined ? null : "inactive";
  }

  return null;
}

/**
 * A deterministic provider-free billing adapter for the local reference flow.
 * Signature verification is deliberately supplied by the outer HTTP/provider adapter.
 */
export class LocalBillingService implements EntitlementService, WebhookEventLedger {
  private readonly entitlements = new Map<string, Entitlement>();
  private readonly processedWebhookEvents = new Set<string>();

  grantEntitlement(input: EntitlementInput): Entitlement {
    const entitlement: Entitlement = {
      workspaceId: input.workspaceId,
      key: input.key,
      state: "active",
    };

    this.entitlements.set(this.entitlementKey(input), entitlement);
    return entitlement;
  }

  revokeEntitlement(input: EntitlementInput): void {
    this.entitlements.delete(this.entitlementKey(input));
  }

  hasEntitlement(input: EntitlementInput): boolean {
    return this.entitlements.has(this.entitlementKey(input));
  }

  processWebhook(input: WebhookEvent): WebhookProcessResult {
    if (input.verification !== "verified") {
      return { disposition: "rejected" };
    }

    const eventKey = this.webhookEventKey(input);
    if (this.processedWebhookEvents.has(eventKey)) {
      return { disposition: "duplicate" };
    }

    this.processedWebhookEvents.add(eventKey);
    const entitlement = {
      workspaceId: input.workspaceId,
      key: input.mutation.entitlement,
    };

    if (input.mutation.type === "grant") {
      this.grantEntitlement(entitlement);
    } else {
      this.revokeEntitlement(entitlement);
    }

    return { disposition: "processed" };
  }

  hasProcessedWebhook(input: Pick<WebhookEvent, "workspaceId" | "id">): boolean {
    return this.processedWebhookEvents.has(this.webhookEventKey(input));
  }

  private entitlementKey(input: EntitlementInput): string {
    return JSON.stringify([input.workspaceId, input.key]);
  }

  private webhookEventKey(input: Pick<WebhookEvent, "workspaceId" | "id">): string {
    return JSON.stringify([input.workspaceId, input.id]);
  }
}
