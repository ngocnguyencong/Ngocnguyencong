import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CreemBillingAdapter, type CreemBillingClient } from "./creem";
import type { SignedStripeWebhookRequest } from "./index";

const secret = "creem_webhook_secret";

function sign(payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function subscriptionPayload(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    created_at: 1_727_000_000_000,
    eventType: "subscription.update",
    id: "evt_123",
    object: {
      customer: { id: "cust_9001" },
      id: "sub_123",
      metadata: {
        entitlement: "ai.reference-task",
        priceId: "prod_555",
        workspaceId: "workspace_01",
      },
      object: "subscription",
      status: "active",
      ...overrides,
    },
  };
}

function client(overrides: Partial<CreemBillingClient> = {}): CreemBillingClient {
  return {
    async createCheckout() {
      return { id: "ch_1", url: "https://creem.io/checkout/abc" };
    },
    async customerPortalLink() {
      return { url: "https://creem.io/my-orders/login/xyz" };
    },
    ...overrides,
  };
}

describe("CreemBillingAdapter", () => {
  it("translates checkout input into a Creem checkout with metadata", async () => {
    let captured: unknown;
    const adapter = new CreemBillingAdapter(
      client({
        async createCheckout(input) {
          captured = input;
          return { id: "ch_1", url: "https://checkout.test/abc" };
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
      metadata: {
        entitlement: "ai.reference-task",
        priceId: "prod_555",
        workspaceId: "workspace_01",
      },
      productId: "prod_555",
      requestId: "checkout_abc",
      successUrl: "https://app.test/billing?checkout=success",
      units: 3,
    });
  });

  it("verifies creem-signature webhooks and maps subscription status", () => {
    const adapter = new CreemBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());

    const verified = adapter.verifySignedWebhook({
      payload,
      signature: sign(payload),
      webhookSecret: secret,
    });

    expect(verified.verification).toBe("verified");
    if (verified.verification === "verified") {
      expect(verified.event).toMatchObject({
        customerId: "cust_9001",
        entitlement: "ai.reference-task",
        entitlementStatus: "active",
        eventId: "evt_123",
        eventType: "subscription.update",
        priceId: "prod_555",
        subscriptionId: "sub_123",
        workspaceId: "workspace_01",
      });
    }
  });

  it("uses the current subscription product instead of stale checkout metadata", () => {
    const adapter = new CreemBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload({ product_id: "prod_ultra" }));

    const verified = adapter.verifySignedWebhook({
      payload,
      signature: sign(payload),
      webhookSecret: secret,
    });

    expect(verified.verification).toBe("verified");
    if (verified.verification === "verified") {
      expect(verified.event.priceId).toBe("prod_ultra");
    }
  });

  it("rejects invalid signatures and maps lifecycle statuses", () => {
    const adapter = new CreemBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());

    expect(
      adapter.verifySignedWebhook({ payload, signature: "deadbeef", webhookSecret: secret })
        .verification,
    ).toBe("rejected");

    for (const [status, expected] of [
      ["active", "active"],
      ["trialing", "trialing"],
      ["past_due", "past_due"],
      ["unpaid", "past_due"],
      ["canceled", "inactive"],
      ["expired", "inactive"],
      ["paused", "inactive"],
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

  it("rejects malformed and mismatched signatures without throwing", () => {
    const adapter = new CreemBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());

    for (const signature of [
      "not-hex",
      "",
      sign(payload).slice(0, 62),
      `${sign(payload)}ff`,
      "f".repeat(64),
    ]) {
      expect(
        adapter.verifySignedWebhook({ payload, signature, webhookSecret: secret }).verification,
        `signature=${signature}`,
      ).toBe("rejected");
    }
  });

  it("rejects non-string runtime inputs without throwing", () => {
    const adapter = new CreemBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());
    const signature = sign(payload);

    const inputs = [
      { payload, signature, webhookSecret: 42 },
      { payload, signature: { value: signature }, webhookSecret: secret },
      { payload: Buffer.from(payload), signature, webhookSecret: secret },
    ];

    for (const input of inputs) {
      expect(
        adapter.verifySignedWebhook(input as unknown as SignedStripeWebhookRequest).verification,
      ).toBe("rejected");
    }
  });

  it("rejects a null input without throwing", () => {
    const adapter = new CreemBillingAdapter(client());
    expect(
      adapter.verifySignedWebhook(null as unknown as SignedStripeWebhookRequest).verification,
    ).toBe("rejected");
  });

  it("treats checkout.completed as active and maps cancel/refund/past_due events", () => {
    const adapter = new CreemBillingAdapter(client());
    const checkout = JSON.stringify({
      created_at: 1_727_000_000_000,
      eventType: "checkout.completed",
      id: "evt_9",
      object: {
        customer: { id: "cust_9001" },
        id: "ch_9",
        metadata: { entitlement: "ai.reference-task", workspaceId: "workspace_01" },
        order: { customer: "cust_9001", status: "paid" },
      },
    });
    const verified = adapter.verifySignedWebhook({
      payload: checkout,
      signature: sign(checkout),
      webhookSecret: secret,
    });
    if (verified.verification === "verified") {
      expect(verified.event).toMatchObject({
        customerId: "cust_9001",
        entitlementStatus: "active",
      });
    }

    for (const [eventType, expected] of [
      ["subscription.paid", "active"],
      ["subscription.past_due", "past_due"],
      ["subscription.unpaid", "past_due"],
      ["subscription.canceled", "inactive"],
      ["subscription.expired", "inactive"],
      ["subscription.paused", "inactive"],
      ["refund.created", "inactive"],
      ["subscription.scheduled_cancel", null],
      ["dispute.created", null],
    ] as const) {
      const parsed = JSON.parse(JSON.stringify(subscriptionPayload())) as {
        eventType: string;
      };
      parsed.eventType = eventType;
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
    const adapter = new CreemBillingAdapter(client());
    const session = await adapter.createPortalSession({
      customerId: "cust_9001",
      returnUrl: "https://app.test/billing",
      workspaceId: "workspace_01",
    });
    expect(session.url).toBe("https://creem.io/my-orders/login/xyz");
  });
});
