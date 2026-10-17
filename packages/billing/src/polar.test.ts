import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PolarBillingAdapter, type PolarBillingClient } from "./polar";
import { encodeStandardWebhookSignature } from "./standard-webhooks";

const secret = "polar_webhook_secret";

/**
 * Mirrors the Standard Webhooks scheme the SDK's `validateEvent` enforces:
 * HMAC-SHA256 over `${id}.${timestamp}.${body}`, published as `v1,<base64>`.
 */
function signedHeaders(payload: string, id = "msg_123") {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v1,${createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64")}`;
  return { "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": signature };
}

function signatureFor(payload: string, id = "msg_123"): string {
  return encodeStandardWebhookSignature(signedHeaders(payload, id));
}

function subscriptionPayload(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    data: {
      customerId: "cust_9001",
      id: "sub_123",
      metadata: {
        entitlement: "ai.reference-task",
        priceId: "prod_555",
        workspaceId: "workspace_01",
      },
      status: "active",
      ...overrides,
    },
    timestamp: "2026-09-22T00:00:00.000Z",
    type: "subscription.updated",
  };
}

function client(overrides: Partial<PolarBillingClient> = {}): PolarBillingClient {
  return {
    async createCheckout() {
      return { id: "chk_1", url: "https://polar.sh/checkout/abc" };
    },
    async createCustomerSession() {
      return { url: "https://polar.sh/portal/xyz" };
    },
    validateWebhook(body, headers, webhookSecret) {
      const signature = headers["webhook-signature"];
      const timestamp = headers["webhook-timestamp"];
      const id = headers["webhook-id"];
      if (!signature || !timestamp || !id) {
        throw new Error("missing webhook headers");
      }
      const expected = `v1,${createHmac("sha256", webhookSecret)
        .update(`${id}.${timestamp}.${body}`)
        .digest("base64")}`;
      if (signature !== expected) {
        throw new Error("bad signature");
      }
      return JSON.parse(body) as unknown;
    },
    ...overrides,
  };
}

describe("PolarBillingAdapter", () => {
  it("translates checkout input into a Polar checkout with metadata", async () => {
    let captured: unknown;
    const adapter = new PolarBillingAdapter(
      client({
        async createCheckout(input) {
          captured = input;
          return { id: "chk_1", url: "https://checkout.test/abc" };
        },
      }),
    );

    const session = await adapter.createCheckoutSession({
      cancelUrl: "https://app.test/billing?checkout=cancelled",
      customerEmail: "buyer@example.test",
      entitlement: "ai.reference-task",
      idempotencyKey: "checkout_abc",
      integrationIdentifier: "supastack_abcd",
      priceId: "prod_555",
      seats: 3,
      successUrl: "https://app.test/billing?checkout=success",
      workspaceId: "workspace_01",
    });

    expect(session.url).toBe("https://checkout.test/abc");
    expect(captured).toMatchObject({
      customerEmail: "buyer@example.test",
      externalCustomerId: "workspace_01",
      metadata: {
        entitlement: "ai.reference-task",
        priceId: "prod_555",
        workspaceId: "workspace_01",
      },
      products: ["prod_555"],
      seats: 3,
      successUrl: "https://app.test/billing?checkout=success",
    });
  });

  it("verifies Standard Webhooks signatures and maps subscription status", () => {
    const adapter = new PolarBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());

    const verified = adapter.verifySignedWebhook({
      payload,
      signature: signatureFor(payload),
      webhookSecret: secret,
    });

    expect(verified.verification).toBe("verified");
    if (verified.verification === "verified") {
      expect(verified.event).toMatchObject({
        customerId: "cust_9001",
        entitlement: "ai.reference-task",
        entitlementStatus: "active",
        eventId: "msg_123",
        eventType: "subscription.updated",
        occurredAt: new Date("2026-09-22T00:00:00.000Z"),
        priceId: "prod_555",
        subscriptionId: "sub_123",
        workspaceId: "workspace_01",
      });
    }
  });

  it("uses the current subscription product instead of stale checkout metadata", () => {
    const adapter = new PolarBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload({ productId: "prod_ultra" }));

    const verified = adapter.verifySignedWebhook({
      payload,
      signature: signatureFor(payload),
      webhookSecret: secret,
    });

    expect(verified.verification).toBe("verified");
    if (verified.verification === "verified") {
      expect(verified.event.priceId).toBe("prod_ultra");
    }
  });

  it("rejects invalid signatures and maps lifecycle statuses", () => {
    const adapter = new PolarBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());

    expect(
      adapter.verifySignedWebhook({ payload, signature: "deadbeef", webhookSecret: secret })
        .verification,
    ).toBe("rejected");
    expect(
      adapter.verifySignedWebhook({
        payload,
        signature: encodeStandardWebhookSignature({
          "webhook-id": "msg_1",
          "webhook-timestamp": "1",
          "webhook-signature": "v1,AAAA",
        }),
        webhookSecret: secret,
      }).verification,
    ).toBe("rejected");

    for (const [status, expected] of [
      ["active", "active"],
      ["trialing", "trialing"],
      ["past_due", "past_due"],
      ["unpaid", "past_due"],
      ["canceled", "inactive"],
      ["incomplete_expired", "inactive"],
      ["paused", "inactive"],
    ] as const) {
      const body = JSON.stringify(subscriptionPayload({ status }));
      const result = adapter.verifySignedWebhook({
        payload: body,
        signature: signatureFor(body),
        webhookSecret: secret,
      });
      if (result.verification === "verified") {
        expect(result.event.entitlementStatus).toBe(expected);
      } else {
        throw new Error("expected verified");
      }
    }
  });

  it("treats order.paid as active and maps cancel/refund/past_due events", () => {
    const adapter = new PolarBillingAdapter(client());
    const order = JSON.stringify({
      data: {
        customerId: "cust_9001",
        id: "order_9",
        metadata: { entitlement: "ai.reference-task", workspaceId: "workspace_01" },
        subscriptionId: "sub_9",
      },
      timestamp: "2026-09-22T00:00:00.000Z",
      type: "order.paid",
    });
    const verified = adapter.verifySignedWebhook({
      payload: order,
      signature: signatureFor(order),
      webhookSecret: secret,
    });
    if (verified.verification === "verified") {
      expect(verified.event).toMatchObject({
        customerId: "cust_9001",
        entitlementStatus: "active",
        subscriptionId: "sub_9",
      });
    } else {
      throw new Error("expected verified for order.paid");
    }

    for (const [eventType, expected] of [
      ["subscription.active", "active"],
      ["subscription.uncanceled", "active"],
      ["subscription.past_due", "past_due"],
      ["subscription.canceled", "inactive"],
      ["subscription.revoked", "inactive"],
      ["order.refunded", "inactive"],
      ["refund.created", "inactive"],
      ["customer.updated", null],
      ["checkout.updated", null],
    ] as const) {
      const parsed = JSON.parse(JSON.stringify(subscriptionPayload())) as {
        type: string;
      };
      parsed.type = eventType;
      const eventBody = JSON.stringify(parsed);
      const result = adapter.verifySignedWebhook({
        payload: eventBody,
        signature: signatureFor(eventBody),
        webhookSecret: secret,
      });
      if (result.verification === "verified") {
        expect(result.event.entitlementStatus, eventType).toBe(expected);
      } else {
        throw new Error(`expected verified for ${eventType}`);
      }
    }
  });

  it("returns a customer portal session URL from a customer session", async () => {
    let capturedCustomerId: string | undefined;
    const adapter = new PolarBillingAdapter(
      client({
        async createCustomerSession(input) {
          capturedCustomerId = input.customerId;
          return { url: "https://polar.sh/portal/session_1" };
        },
      }),
    );
    const session = await adapter.createPortalSession({
      customerId: "cust_9001",
      returnUrl: "https://app.test/billing",
      workspaceId: "workspace_01",
    });
    expect(capturedCustomerId).toBe("cust_9001");
    expect(session.url).toBe("https://polar.sh/portal/session_1");
  });
});
