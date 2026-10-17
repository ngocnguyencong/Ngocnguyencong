import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PaddleBillingAdapter, type PaddleBillingClient } from "./paddle";

const secret = "paddle_webhook_secret";

function sign(payload: string, timestamp = "1_727_000_000".replaceAll("_", "")): string {
  const h1 = createHmac("sha256", secret).update(`${timestamp}:${payload}`).digest("hex");
  return `ts=${timestamp};h1=${h1}`;
}

function subscriptionPayload(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    data: {
      customer_id: "ctm_123",
      custom_data: {
        entitlement: "ai.reference-task",
        priceId: "pri_555",
        workspaceId: "workspace_01",
      },
      id: "sub_123",
      status: "active",
      ...overrides,
    },
    event_id: "evt_123",
    event_type: "subscription.updated",
    notification_id: "ntf_123",
    occurred_at: "2026-09-04T12:00:00.000Z",
  };
}

function client(overrides: Partial<PaddleBillingClient> = {}): PaddleBillingClient {
  return {
    async createTransaction() {
      return { id: "txn_1", url: "https://paddle.test/checkout/txn_1" };
    },
    async createCustomerPortalSession() {
      return { url: "https://paddle.test/portal/session" };
    },
    ...overrides,
  };
}

describe("PaddleBillingAdapter", () => {
  it("translates checkout input into a Paddle transaction with custom data", async () => {
    let captured: unknown;
    const adapter = new PaddleBillingAdapter(
      client({
        async createTransaction(input) {
          captured = input;
          return { id: "txn_1", url: "https://checkout.test/txn_1" };
        },
      }),
    );

    const session = await adapter.createCheckoutSession({
      cancelUrl: "https://app.test/billing?checkout=cancelled",
      customerEmail: "buyer@example.test",
      entitlement: "ai.reference-task",
      idempotencyKey: "checkout_abc",
      integrationIdentifier: "supastack_abcd",
      priceId: "pri_555",
      seats: 3,
      successUrl: "https://app.test/billing?checkout=success",
      workspaceId: "workspace_01",
    });

    expect(session.url).toBe("https://checkout.test/txn_1");
    expect(captured).toMatchObject({
      customerEmail: "buyer@example.test",
      customData: {
        entitlement: "ai.reference-task",
        priceId: "pri_555",
        workspaceId: "workspace_01",
      },
      items: [{ priceId: "pri_555", quantity: 3 }],
    });
  });

  it("verifies Paddle-Signature webhooks and maps subscription status", () => {
    const adapter = new PaddleBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());

    const verified = adapter.verifySignedWebhook({
      payload,
      signature: sign(payload),
      webhookSecret: secret,
    });

    expect(verified.verification).toBe("verified");
    if (verified.verification === "verified") {
      expect(verified.event).toMatchObject({
        customerId: "ctm_123",
        entitlement: "ai.reference-task",
        entitlementStatus: "active",
        eventId: "evt_123",
        eventType: "subscription.updated",
        priceId: "pri_555",
        subscriptionId: "sub_123",
        workspaceId: "workspace_01",
      });
    }
  });

  it("rejects invalid signatures and maps lifecycle statuses", () => {
    const adapter = new PaddleBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());

    expect(
      adapter.verifySignedWebhook({ payload, signature: "ts=1;h1=deadbeef", webhookSecret: secret })
        .verification,
    ).toBe("rejected");
    expect(
      adapter.verifySignedWebhook({ payload, signature: "not-a-signature", webhookSecret: secret })
        .verification,
    ).toBe("rejected");

    for (const [status, expected] of [
      ["active", "active"],
      ["trialing", "trialing"],
      ["past_due", "past_due"],
      ["paused", "inactive"],
      ["canceled", "inactive"],
    ] as const) {
      const body = JSON.stringify(subscriptionPayload({ status }));
      const result = adapter.verifySignedWebhook({
        payload: body,
        signature: sign(body),
        webhookSecret: secret,
      });
      if (result.verification === "verified") {
        expect(result.event.entitlementStatus).toBe(expected);
      } else {
        throw new Error("expected verified");
      }
    }
  });

  it("treats transaction.completed as active and maps failure/refund events", () => {
    const adapter = new PaddleBillingAdapter(client());
    const transaction = JSON.stringify({
      data: {
        customer_id: "ctm_123",
        custom_data: { entitlement: "ai.reference-task", workspaceId: "workspace_01" },
        id: "txn_9",
        subscription_id: "sub_123",
      },
      event_id: "evt_9",
      event_type: "transaction.completed",
      occurred_at: "2026-09-04T12:00:00.000Z",
    });
    const verified = adapter.verifySignedWebhook({
      payload: transaction,
      signature: sign(transaction),
      webhookSecret: secret,
    });
    if (verified.verification === "verified") {
      expect(verified.event).toMatchObject({
        customerId: "ctm_123",
        entitlementStatus: "active",
        subscriptionId: "sub_123",
      });
    }

    for (const [eventType, data, expected] of [
      ["transaction.paid", {}, "active"],
      ["transaction.payment_failed", {}, "past_due"],
      ["transaction.past_due", {}, "past_due"],
      ["transaction.canceled", {}, null],
      ["adjustment.updated", { action: "refund", status: "approved" }, "inactive"],
      ["adjustment.updated", { action: "chargeback", status: "approved" }, "inactive"],
      ["adjustment.created", { action: "refund", status: "pending_approval" }, null],
      ["subscription.activated", { status: "active" }, "active"],
      ["subscription.trialing", { status: "trialing" }, "trialing"],
      ["subscription.past_due", { status: "past_due" }, "past_due"],
      ["subscription.canceled", { status: "canceled" }, "inactive"],
      ["subscription.paused", { status: "paused" }, "inactive"],
      ["subscription.resumed", { status: "active" }, "active"],
      ["customer.updated", {}, null],
    ] as const) {
      const parsed = JSON.parse(JSON.stringify(subscriptionPayload())) as {
        data: Record<string, unknown>;
        event_type: string;
      };
      parsed.event_type = eventType;
      parsed.data = { ...parsed.data, ...data };
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

  it("returns a customer portal session URL", async () => {
    const adapter = new PaddleBillingAdapter(client());
    const session = await adapter.createPortalSession({
      customerId: "ctm_123",
      returnUrl: "https://app.test/billing",
      workspaceId: "workspace_01",
    });
    expect(session.url).toBe("https://paddle.test/portal/session");
  });
});
