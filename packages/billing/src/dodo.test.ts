import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { DodoBillingAdapter, type DodoBillingClient } from "./dodo";
import { encodeStandardWebhookSignature } from "./standard-webhooks";

const secret = "dodo_test_webhook_key";

function sign(payload: string, webhookId = "msg_dodo_1"): string {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const expected = createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(`${webhookId}.${timestamp}.${payload}`)
    .digest("base64");
  return encodeStandardWebhookSignature({
    "webhook-id": webhookId,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${expected}`,
  });
}

function subscriptionPayload(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    business_id: "biz_123",
    data: {
      customer: { customer_id: "cus_123" },
      metadata: {
        entitlement: "ai.reference-task",
        priceId: "pdt_555",
        workspaceId: "workspace_01",
      },
      payload_type: "Subscription",
      status: "active",
      subscription_id: "sub_123",
      ...overrides,
    },
    timestamp: "2026-09-04T12:00:00.000Z",
    type: "subscription.updated",
  };
}

function client(overrides: Partial<DodoBillingClient> = {}): DodoBillingClient {
  return {
    async createCheckout() {
      return { id: "cks_1", url: "https://checkout.dodopayments.test/cks_1" };
    },
    async createCustomerPortalLink() {
      return { url: "https://customer.dodopayments.test/session" };
    },
    ...overrides,
  };
}

describe("DodoBillingAdapter", () => {
  it("translates checkout input into a Dodo checkout session with metadata", async () => {
    let captured: unknown;
    const adapter = new DodoBillingAdapter(
      client({
        async createCheckout(input) {
          captured = input;
          return { id: "cks_1", url: "https://checkout.test/cks_1" };
        },
      }),
    );

    const session = await adapter.createCheckoutSession({
      cancelUrl: "https://app.test/billing?checkout=cancelled",
      customerEmail: "buyer@example.test",
      entitlement: "ai.reference-task",
      idempotencyKey: "checkout_abc",
      integrationIdentifier: "supastack_abcd",
      priceId: "pdt_555",
      seats: 2,
      successUrl: "https://app.test/billing?checkout=success",
      workspaceId: "workspace_01",
    });

    expect(session.url).toBe("https://checkout.test/cks_1");
    expect(captured).toMatchObject({
      customerEmail: "buyer@example.test",
      metadata: {
        entitlement: "ai.reference-task",
        priceId: "pdt_555",
        workspaceId: "workspace_01",
      },
      productId: "pdt_555",
      quantity: 2,
      returnUrl: "https://app.test/billing?checkout=success",
    });
  });

  it("verifies Standard Webhooks signatures and maps subscription status", () => {
    const adapter = new DodoBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());

    const verified = adapter.verifySignedWebhook({
      payload,
      signature: sign(payload),
      webhookSecret: secret,
    });

    expect(verified.verification).toBe("verified");
    if (verified.verification === "verified") {
      expect(verified.event).toMatchObject({
        customerId: "cus_123",
        entitlement: "ai.reference-task",
        entitlementStatus: "active",
        eventId: "msg_dodo_1",
        eventType: "subscription.updated",
        priceId: "pdt_555",
        subscriptionId: "sub_123",
        workspaceId: "workspace_01",
      });
      expect(verified.event.occurredAt).toEqual(new Date("2026-09-04T12:00:00.000Z"));
    }
  });

  it("rejects bad signatures and stale timestamps", () => {
    const adapter = new DodoBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());

    expect(
      adapter.verifySignedWebhook({
        payload,
        signature: sign(payload).replace(/v1,/, "v1,bad"),
        webhookSecret: secret,
      }).verification,
    ).toBe("rejected");

    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 3600);
    const staleSignature = encodeStandardWebhookSignature({
      "webhook-id": "msg_stale",
      "webhook-timestamp": staleTimestamp,
      "webhook-signature": `v1,${createHmac("sha256", Buffer.from(secret, "utf8"))
        .update(`msg_stale.${staleTimestamp}.${payload}`)
        .digest("base64")}`,
    });
    expect(
      adapter.verifySignedWebhook({
        payload,
        signature: staleSignature,
        webhookSecret: secret,
      }).verification,
    ).toBe("rejected");
  });

  it("verifies with a whsec_-prefixed base64 webhook key", () => {
    const keyBytes = Buffer.from("dodo-secret-bytes", "utf8");
    const prefixedSecret = `whsec_${keyBytes.toString("base64")}`;
    const payload = JSON.stringify(subscriptionPayload());
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = encodeStandardWebhookSignature({
      "webhook-id": "msg_whsec",
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${createHmac("sha256", keyBytes)
        .update(`msg_whsec.${timestamp}.${payload}`)
        .digest("base64")}`,
    });

    const adapter = new DodoBillingAdapter(client());
    expect(
      adapter.verifySignedWebhook({
        payload,
        signature,
        webhookSecret: prefixedSecret,
      }).verification,
    ).toBe("verified");
  });

  it("maps lifecycle events onto entitlement statuses", () => {
    const adapter = new DodoBillingAdapter(client());

    for (const [eventType, expected] of [
      ["payment.succeeded", "active"],
      ["payment.failed", "past_due"],
      ["payment.processing", null],
      ["payment.cancelled", null],
      ["subscription.active", "active"],
      ["subscription.renewed", "active"],
      ["subscription.unpaused", "active"],
      ["subscription.on_hold", "past_due"],
      ["subscription.failed", "past_due"],
      ["subscription.cancelled", "inactive"],
      ["subscription.expired", "inactive"],
      ["subscription.paused", "inactive"],
      ["refund.succeeded", "inactive"],
      ["dispute.lost", "inactive"],
      ["dispute.opened", null],
      ["license_key.created", null],
    ] as const) {
      const parsed = JSON.parse(JSON.stringify(subscriptionPayload())) as { type: string };
      parsed.type = eventType;
      if (eventType.startsWith("payment.")) {
        (parsed.data as Record<string, unknown>).payment_id = "pay_9";
      }
      const eventBody = JSON.stringify(parsed);
      const result = adapter.verifySignedWebhook({
        payload: eventBody,
        signature: sign(eventBody),
        webhookSecret: secret,
      });
      if (result.verification === "verified") {
        expect(result.event.entitlementStatus, eventType).toBe(expected);
      } else {
        throw new Error(`expected verified for ${eventType}`);
      }
    }
  });

  it("reads top-level customer_id on payment payloads", () => {
    const adapter = new DodoBillingAdapter(client());
    const payload = JSON.stringify({
      business_id: "biz_123",
      data: {
        customer_id: "cus_123",
        metadata: { entitlement: "ai.reference-task", workspaceId: "workspace_01" },
        payload_type: "Payment",
        payment_id: "pay_9",
        status: "succeeded",
        subscription_id: "sub_123",
      },
      timestamp: "2026-09-04T12:00:00.000Z",
      type: "payment.succeeded",
    });

    const verified = adapter.verifySignedWebhook({
      payload,
      signature: sign(payload),
      webhookSecret: secret,
    });
    if (verified.verification === "verified") {
      expect(verified.event).toMatchObject({
        customerId: "cus_123",
        entitlementStatus: "active",
        subscriptionId: "sub_123",
      });
    } else {
      throw new Error("expected verified");
    }
  });

  it("returns a customer portal session URL", async () => {
    const adapter = new DodoBillingAdapter(client());
    const session = await adapter.createPortalSession({
      customerId: "cus_123",
      returnUrl: "https://app.test/billing",
      workspaceId: "workspace_01",
    });
    expect(session.url).toBe("https://customer.dodopayments.test/session");
  });
});
