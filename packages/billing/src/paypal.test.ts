import { describe, expect, it } from "vitest";

import {
  PaypalBillingAdapter,
  encodePaypalWebhookSignature,
  type PaypalBillingClient,
} from "./paypal";

const webhookId = "WH_test_id";

function signature(): string {
  return encodePaypalWebhookSignature({
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.paypal.com/certs/cert.pem",
    "paypal-transmission-id": "tx_123",
    "paypal-transmission-sig": "sig_abc",
    "paypal-transmission-time": "2026-09-04T12:00:00.000Z",
  });
}

function subscriptionPayload(overrides: Readonly<Record<string, unknown>> = {}) {
  const workspaceId = "workspace_01";
  return {
    create_time: "2026-09-04T12:00:00.000Z",
    event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
    id: "WH-123",
    resource: {
      custom_id: JSON.stringify({
        e: "ai.reference-task",
        p: "P-555",
        w: workspaceId,
      }),
      id: "I-ABC123",
      plan_id: "P-555",
      status: "ACTIVE",
      subscriber: { payer_id: "PAYER123" },
      ...overrides,
    },
    resource_type: "subscription",
  };
}

function client(overrides: Partial<PaypalBillingClient> = {}): PaypalBillingClient {
  return {
    async createSubscription() {
      return { id: "I-NEW", url: "https://paypal.test/checkout/I-NEW" };
    },
    async subscriptionPortalUrl() {
      return { url: "https://www.paypal.com/myaccount/autopay/" };
    },
    async verifyWebhookSignature() {
      return { verificationStatus: "SUCCESS" };
    },
    ...overrides,
  };
}

describe("PaypalBillingAdapter", () => {
  it("creates a subscription checkout with a packed custom_id", async () => {
    let captured: unknown;
    const adapter = new PaypalBillingAdapter(
      client({
        async createSubscription(input) {
          captured = input;
          return { id: "I-NEW", url: "https://paypal.test/checkout/I-NEW" };
        },
      }),
    );

    const session = await adapter.createCheckoutSession({
      cancelUrl: "https://app.test/billing?checkout=cancelled",
      customerEmail: "buyer@example.test",
      entitlement: "ai.reference-task",
      idempotencyKey: "checkout_abc",
      integrationIdentifier: "supastack_abcd",
      priceId: "P-555",
      successUrl: "https://app.test/billing?checkout=success",
      workspaceId: "workspace_01",
    });

    expect(session).toEqual({ id: "I-NEW", url: "https://paypal.test/checkout/I-NEW" });
    expect(captured).toMatchObject({
      cancelUrl: "https://app.test/billing?checkout=cancelled",
      planId: "P-555",
      returnUrl: "https://app.test/billing?checkout=success",
      subscriberEmail: "buyer@example.test",
    });
    const { customId } = captured as { customId: string };
    expect(JSON.parse(customId)).toEqual({
      e: "ai.reference-task",
      p: "P-555",
      w: "workspace_01",
    });
  });

  it("verifies webhooks through the PayPal API and maps activated subscriptions", async () => {
    const adapter = new PaypalBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());

    const verified = await adapter.verifySignedWebhook({
      payload,
      signature: signature(),
      webhookSecret: webhookId,
    });

    expect(verified.verification).toBe("verified");
    if (verified.verification === "verified") {
      expect(verified.event).toMatchObject({
        customerId: "PAYER123",
        entitlement: "ai.reference-task",
        entitlementStatus: "active",
        eventId: "WH-123",
        eventType: "BILLING.SUBSCRIPTION.ACTIVATED",
        priceId: "P-555",
        subscriptionId: "I-ABC123",
        workspaceId: "workspace_01",
      });
    }
  });

  it("forwards the five verification headers plus webhook id to the API", async () => {
    let captured: unknown;
    const adapter = new PaypalBillingAdapter(
      client({
        async verifyWebhookSignature(input) {
          captured = input;
          return { verificationStatus: "SUCCESS" };
        },
      }),
    );

    await adapter.verifySignedWebhook({
      payload: JSON.stringify(subscriptionPayload()),
      signature: signature(),
      webhookSecret: webhookId,
    });

    expect(captured).toMatchObject({
      authAlgo: "SHA256withRSA",
      certUrl: "https://api.paypal.com/certs/cert.pem",
      transmissionId: "tx_123",
      transmissionSig: "sig_abc",
      transmissionTime: "2026-09-04T12:00:00.000Z",
      webhookId: "WH_test_id",
    });
    expect((captured as { webhookEvent: { id: string } }).webhookEvent.id).toBe("WH-123");
  });

  it("rejects when PayPal returns FAILURE or the verify call throws", async () => {
    const payload = JSON.stringify(subscriptionPayload());
    const failing = new PaypalBillingAdapter(
      client({
        async verifyWebhookSignature() {
          return { verificationStatus: "FAILURE" };
        },
      }),
    );
    await expect(
      failing.verifySignedWebhook({ payload, signature: signature(), webhookSecret: webhookId }),
    ).resolves.toEqual({ verification: "rejected" });

    const throwing = new PaypalBillingAdapter(
      client({
        async verifyWebhookSignature() {
          throw new Error("network down");
        },
      }),
    );
    await expect(
      throwing.verifySignedWebhook({ payload, signature: signature(), webhookSecret: webhookId }),
    ).resolves.toEqual({ verification: "rejected" });

    const adapter = new PaypalBillingAdapter(client());
    await expect(
      adapter.verifySignedWebhook({
        payload,
        signature: "not-json",
        webhookSecret: webhookId,
      }),
    ).resolves.toEqual({ verification: "rejected" });
  });

  it("maps lifecycle events onto entitlement statuses", async () => {
    const adapter = new PaypalBillingAdapter(client());

    for (const [eventType, status, expected] of [
      ["BILLING.SUBSCRIPTION.ACTIVATED", "ACTIVE", "active"],
      ["BILLING.SUBSCRIPTION.RE-ACTIVATED", "ACTIVE", "active"],
      ["PAYMENT.SALE.COMPLETED", "COMPLETED", "active"],
      ["BILLING.SUBSCRIPTION.PAYMENT.FAILED", "ACTIVE", "past_due"],
      ["BILLING.SUBSCRIPTION.SUSPENDED", "SUSPENDED", "past_due"],
      ["BILLING.SUBSCRIPTION.CANCELLED", "CANCELLED", "inactive"],
      ["BILLING.SUBSCRIPTION.EXPIRED", "EXPIRED", "inactive"],
      ["PAYMENT.SALE.REFUNDED", "COMPLETED", "inactive"],
      ["BILLING.SUBSCRIPTION.CREATED", "APPROVED", null],
      ["BILLING.SUBSCRIPTION.CREATED", "ACTIVE", "active"],
      ["BILLING.SUBSCRIPTION.UPDATED", "SUSPENDED", "past_due"],
      ["CUSTOMER.DISPUTE.CREATED", undefined, null],
    ] as const) {
      const parsed = JSON.parse(JSON.stringify(subscriptionPayload())) as {
        event_type: string;
        resource: Record<string, unknown>;
      };
      parsed.event_type = eventType;
      if (status === undefined) {
        delete parsed.resource.status;
      } else {
        parsed.resource.status = status;
      }
      if (eventType.startsWith("PAYMENT.SALE.")) {
        parsed.resource.billing_agreement_id = "I-ABC123";
      }
      const result = await adapter.verifySignedWebhook({
        payload: JSON.stringify(parsed),
        signature: signature(),
        webhookSecret: webhookId,
      });
      if (result.verification === "verified") {
        expect(result.event.entitlementStatus, eventType).toBe(expected);
      } else {
        throw new Error(`expected verified for ${eventType}`);
      }
    }
  });

  it("falls back to the subscription id as billing identity when no payer id exists", async () => {
    const adapter = new PaypalBillingAdapter(client());
    const parsed = subscriptionPayload();
    const resource = parsed.resource as { subscriber?: unknown };
    delete resource.subscriber;

    const verified = await adapter.verifySignedWebhook({
      payload: JSON.stringify(parsed),
      signature: signature(),
      webhookSecret: webhookId,
    });

    if (verified.verification === "verified") {
      expect(verified.event.customerId).toBe("I-ABC123");
      expect(verified.event.subscriptionId).toBe("I-ABC123");
    } else {
      throw new Error("expected verified");
    }
  });

  it("returns the PayPal self-service portal URL", async () => {
    const adapter = new PaypalBillingAdapter(client());
    const session = await adapter.createPortalSession({
      customerId: "I-ABC123",
      returnUrl: "https://app.test/billing",
      workspaceId: "workspace_01",
    });
    expect(session.url).toBe("https://www.paypal.com/myaccount/autopay/");
  });
});
