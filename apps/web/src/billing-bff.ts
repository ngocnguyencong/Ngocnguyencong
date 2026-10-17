import { createHash } from "node:crypto";

import type {
  SignedStripeWebhookRequest,
  SignedStripeWebhookVerification,
  StripeBillingAdapter,
  StripeCheckoutRequest,
  StripePortalRequest,
} from "@supastack/billing";
import type { ApplyStripeBillingEventInput, StripeBillingEventApplyResult } from "@supastack/db";
import { canManageWorkspaceMembers, type WorkspaceRole } from "@supastack/db";
import { isCorrelationId, newCorrelationId } from "@supastack/observability";

import { resolveProductCheckout, type ProductPlanPriceMap } from "./product-plans";
import type { NotificationProductEvent } from "./notification-events";
import { billingEventFromEntitlement } from "./notification-events";

export interface BillingIdentity {
  user: { id: string };
}

export interface BillingContext {
  customerId: string | null;
  email: string;
  role: WorkspaceRole;
  workspaceId: string;
}

export type CheckoutIdentityInput = Omit<
  StripeCheckoutRequest,
  "idempotencyKey" | "integrationIdentifier"
>;

export type CheckoutIdentity = Readonly<{
  idempotencyKey: string;
  integrationIdentifier: string;
}>;

export function createStableCheckoutIdentity(input: CheckoutIdentityInput): CheckoutIdentity {
  const stableIdentity = [
    input.workspaceId,
    input.entitlement,
    input.priceId,
    input.successUrl,
    input.cancelUrl,
    input.customerId ?? "",
    input.customerEmail?.trim().toLowerCase() ?? "",
  ].join("\u001f");
  const digest = createHash("sha256").update(stableIdentity).digest("hex");

  return Object.freeze({
    idempotencyKey: `checkout_${digest}`,
    integrationIdentifier: `supastack_${digest
      .slice(0, 8)
      .split("")
      .map((character) => String.fromCharCode(97 + Number.parseInt(character, 16)))
      .join("")}`,
  });
}

export interface BillingBffDependencies {
  applyStripeBillingEvent: (
    input: ApplyStripeBillingEventInput,
  ) => Promise<StripeBillingEventApplyResult>;
  billing: Pick<StripeBillingAdapter, "createCheckoutSession" | "createPortalSession"> & {
    /**
     * Most providers verify signatures locally and return synchronously;
     * PayPal verifies through its API, so the contract also accepts a Promise.
     */
    verifySignedWebhook(
      input: SignedStripeWebhookRequest,
    ): Promise<SignedStripeWebhookVerification> | SignedStripeWebhookVerification;
  };
  config: Readonly<{
    appUrl: string;
    entitlement: string;
    priceId: string;
    priceMap?: ProductPlanPriceMap;
    provider?: string;
    webhookSecret: string;
  }>;
  createCheckoutIdentity: (input: CheckoutIdentityInput) => CheckoutIdentity;
  findBillingContext: (userId: string, headers: Headers) => Promise<BillingContext | null>;
  getSession: (headers: Headers) => Promise<BillingIdentity | null>;
  now: () => Date;
  /** Optional in-app notification fan-out after a processed lifecycle write. */
  onBillingLifecycleProcessed?: (
    event: NotificationProductEvent,
    context: BillingWebhookEmitContext,
  ) => Promise<void>;
  /**
   * Optional credit-grant hook fired when a lifecycle write leaves the
   * workspace's entitlement active (status `active` or `trialing`) —
   * the seam where plan `creditGrant`s are applied. Runs BEFORE
   * `onBillingLifecycleProcessed`; absent = no credit grants. It also
   * re-fires on "duplicate" dispositions: if the post-commit hook threw on
   * the first delivery, the provider's retry would otherwise dedupe forever
   * and the paid credits would be lost — the hook must stay idempotent on
   * its own reference so replays heal the grant instead of doubling it.
   */
  onEntitlementActivated?: (
    input: Readonly<{
      entitlementKey: string;
      eventId: string;
      status: "active" | "trialing";
      subscriptionId: string | null;
      workspaceId: string;
    }>,
  ) => Promise<void>;
}

/**
 * Observability context for the post-persist emit fan-out — keeps the
 * request correlationId off the product-notification event type itself.
 */
export interface BillingWebhookEmitContext {
  readonly correlationId: string;
}

export interface BillingWebhookInput {
  /**
   * `corr_<uuid>` minted by the receiving route for this request — the same
   * id the route puts on its failure `captureException`. Absent or malformed
   * values are replaced with a fresh mint so every processed webhook still
   * correlates.
   */
  correlationId?: string;
  payload: string;
  signature: string;
}

type ErrorCode = "conflict" | "forbidden" | "providerError" | "unauthorized" | "validationError";

function errorResponse(status: 400 | 401 | 403 | 409 | 502, code: ErrorCode, message: string) {
  return { body: { error: { code, message } }, status } as const;
}

/**
 * Framework-neutral billing boundary. Browser requests contribute only their
 * authenticated cookies; every billing identity and product field is server-derived.
 */
export function createBillingBff(dependencies: BillingBffDependencies) {
  async function authenticatedContext(headers: Headers) {
    if (!hasTrustedOrigin(headers, dependencies.config.appUrl)) {
      return {
        error: errorResponse(403, "forbidden", "This billing request is not same-origin."),
      } as const;
    }

    const session = await dependencies.getSession(headers);
    if (session === null) {
      return {
        error: errorResponse(401, "unauthorized", "Sign in before managing billing."),
      } as const;
    }

    const context = await dependencies.findBillingContext(session.user.id, headers);
    if (context === null) {
      return {
        error: errorResponse(409, "conflict", "The workspace is not ready for billing."),
      } as const;
    }

    if (!canManageWorkspaceMembers(context.role)) {
      return {
        error: errorResponse(
          403,
          "forbidden",
          "Only workspace owners and admins can manage billing.",
        ),
      } as const;
    }

    return { context } as const;
  }

  return {
    async checkout(headers: Headers, rawBody: unknown = null) {
      const authenticated = await authenticatedContext(headers);
      if ("error" in authenticated) {
        return authenticated.error;
      }

      const planId =
        typeof rawBody === "object" &&
        rawBody !== null &&
        "planId" in rawBody &&
        typeof (rawBody as { planId?: unknown }).planId === "string"
          ? (rawBody as { planId: string }).planId
          : "pro";
      const interval =
        typeof rawBody === "object" &&
        rawBody !== null &&
        "interval" in rawBody &&
        (rawBody as { interval?: unknown }).interval === "year"
          ? ("year" as const)
          : undefined;
      const prices: ProductPlanPriceMap = {
        pro: dependencies.config.priceId,
        ...dependencies.config.priceMap,
      };
      const resolved = resolveProductCheckout(planId, prices, interval);
      const rawSeats =
        typeof rawBody === "object" && rawBody !== null && "seats" in rawBody
          ? Number((rawBody as { seats?: unknown }).seats)
          : undefined;
      const seats =
        rawSeats !== undefined && Number.isInteger(rawSeats) && rawSeats >= 1 && rawSeats <= 999
          ? rawSeats
          : undefined;
      if (!resolved.ok) {
        return errorResponse(
          400,
          "validationError",
          resolved.reason === "price-unconfigured"
            ? "That plan is not configured for Checkout yet."
            : "Choose a checkoutable product plan.",
        );
      }

      const checkoutInput: CheckoutIdentityInput = {
        cancelUrl: new URL("/billing?checkout=cancelled", dependencies.config.appUrl).toString(),
        ...(authenticated.context.customerId === null
          ? { customerEmail: authenticated.context.email }
          : { customerId: authenticated.context.customerId }),
        entitlement: resolved.entitlement,
        priceId: resolved.priceId,
        ...(seats === undefined ? {} : { seats }),
        successUrl: new URL("/billing?checkout=success", dependencies.config.appUrl).toString(),
        workspaceId: authenticated.context.workspaceId,
      };
      const { idempotencyKey, integrationIdentifier } =
        dependencies.createCheckoutIdentity(checkoutInput);
      if (!/^supastack_[a-z]{8}$/.test(integrationIdentifier)) {
        throw new Error("Stripe integration identifier must end in eight lowercase characters.");
      }
      if (!/^checkout_[a-f0-9]{64}$/.test(idempotencyKey)) {
        throw new Error("Stripe Checkout idempotency key must contain one SHA-256 digest.");
      }

      const input: StripeCheckoutRequest = {
        ...checkoutInput,
        idempotencyKey,
        integrationIdentifier,
      };
      const session = await dependencies.billing.createCheckoutSession(input);

      return session.url === null
        ? errorResponse(502, "providerError", "Stripe did not return a Checkout URL.")
        : ({ body: { data: { url: session.url } }, status: 200 } as const);
    },

    async portal(headers: Headers) {
      const authenticated = await authenticatedContext(headers);
      if ("error" in authenticated) {
        return authenticated.error;
      }

      if (authenticated.context.customerId === null) {
        return errorResponse(
          409,
          "conflict",
          "Complete a Stripe Checkout before opening the Customer Portal.",
        );
      }

      const input: StripePortalRequest = {
        customerId: authenticated.context.customerId,
        returnUrl: new URL("/billing", dependencies.config.appUrl).toString(),
        workspaceId: authenticated.context.workspaceId,
      };
      const session = await dependencies.billing.createPortalSession(input);

      return { body: { data: { url: session.url } }, status: 200 } as const;
    },

    async webhook(input: BillingWebhookInput) {
      // One correlationId per webhook request: the route's captureException,
      // the webhook_event ledger payload, and the emitted workspace event all
      // share it, so an operator can trace receipt → persist → delivery.
      const correlationId = isCorrelationId(input.correlationId)
        ? input.correlationId
        : newCorrelationId();
      const emitContext: BillingWebhookEmitContext = { correlationId };
      const signedRequest: SignedStripeWebhookRequest = {
        payload: input.payload,
        signature: input.signature,
        webhookSecret: dependencies.config.webhookSecret,
      };
      const verification = await dependencies.billing.verifySignedWebhook(signedRequest);

      if (verification.verification === "rejected") {
        return errorResponse(400, "validationError", "The Stripe signature is invalid.");
      }

      const payload = parseJsonObject(input.payload);
      if (payload === null) {
        return errorResponse(400, "validationError", "The Stripe payload is invalid.");
      }

      const entitlementStatus = verification.event.entitlementStatus;
      if (entitlementStatus === null) {
        return { body: { data: { disposition: "ignored" } }, status: 200 } as const;
      }

      const event = verification.event;
      const persisted = await dependencies.applyStripeBillingEvent({
        provider: dependencies.config.provider ?? "stripe",
        ...(event.customerId === undefined ? {} : { customerId: event.customerId }),
        ...(event.entitlement === undefined ? {} : { entitlement: event.entitlement }),
        entitlementStatus,
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        // Folded into the stored webhook_event payload (jsonb — no column):
        // the ledger row stays queryable by this request's correlationId.
        payload: { ...payload, correlationId },
        ...(event.priceId === undefined ? {} : { priceId: event.priceId }),
        ...(event.subscriptionId === undefined ? {} : { subscriptionId: event.subscriptionId }),
        verifiedAt: dependencies.now(),
        ...(event.workspaceId === undefined ? {} : { workspaceId: event.workspaceId }),
      });

      if (
        (persisted.disposition === "processed" || persisted.disposition === "duplicate") &&
        persisted.workspaceId &&
        (entitlementStatus === "active" || entitlementStatus === "trialing") &&
        dependencies.onEntitlementActivated
      ) {
        await dependencies.onEntitlementActivated({
          entitlementKey: event.entitlement ?? dependencies.config.entitlement,
          eventId: event.eventId,
          status: entitlementStatus,
          subscriptionId: event.subscriptionId ?? null,
          workspaceId: persisted.workspaceId,
        });
      }

      if (
        persisted.disposition === "processed" &&
        persisted.workspaceId &&
        dependencies.onBillingLifecycleProcessed
      ) {
        await dependencies.onBillingLifecycleProcessed(
          billingEventFromEntitlement(persisted.workspaceId, entitlementStatus),
          emitContext,
        );
      }

      return {
        body: { data: { disposition: persisted.disposition } },
        status: 200,
      } as const;
    },
  };
}

function hasTrustedOrigin(headers: Headers, appUrl: string): boolean {
  const origin = headers.get("origin");
  return origin !== null && origin === new URL(appUrl).origin;
}

function parseJsonObject(payload: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
