import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { SignedStripeWebhookRequest } from "./index";
import { LemonSqueezyBillingAdapter, type LemonSqueezyBillingClient } from "./lemonsqueezy";

const secret = "ls_signing_secret";

function sign(payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function subscriptionPayload(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    data: {
      attributes: {
        customer_id: 9001,
        status: "active",
        updated_at: "2026-09-16T10:00:00.000Z",
        variant_id: 555,
        ...overrides,
      },
      id: "sub_123",
      type: "subscriptions",
    },
    meta: {
      custom_data: {
        entitlement: "ai.reference-task",
        priceId: "555",
        workspaceId: "workspace_01",
      },
      event_name: "subscription_updated",
    },
  };
}

function client(overrides: Partial<LemonSqueezyBillingClient> = {}): LemonSqueezyBillingClient {
  return {
    async createCheckout() {
      return { id: "checkout_1", url: "https://store.lemonsqueezy.com/checkout/abc" };
    },
    async customerPortalUrl() {
      return { url: "https://store.lemonsqueezy.com/billing/portal" };
    },
    ...overrides,
  };
}

describe("LemonSqueezyBillingAdapter", () => {
  it("translates checkout input into a Lemon Squeezy checkout with custom data", async () => {
    let captured: unknown;
    const adapter = new LemonSqueezyBillingAdapter(
      client({
        async createCheckout(input) {
          captured = input;
          return { id: "checkout_1", url: "https://checkout.test/abc" };
        },
      }),
    );

    const session = await adapter.createCheckoutSession({
      cancelUrl: "https://app.test/billing?checkout=cancelled",
      customerEmail: "buyer@example.test",
      entitlement: "ai.reference-task",
      idempotencyKey: "checkout_abc",
      integrationIdentifier: "supastack_abcd",
      priceId: "555",
      seats: 3,
      successUrl: "https://app.test/billing?checkout=success",
      workspaceId: "workspace_01",
    });

    expect(session.url).toBe("https://checkout.test/abc");
    expect(captured).toMatchObject({
      checkoutData: {
        custom: {
          entitlement: "ai.reference-task",
          priceId: "555",
          workspaceId: "workspace_01",
        },
        email: "buyer@example.test",
      },
      productOptions: { redirectUrl: "https://app.test/billing?checkout=success" },
      quantity: 3,
      variantId: "555",
    });
  });

  it("verifies signed webhooks and maps subscription status", () => {
    const adapter = new LemonSqueezyBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());

    const verified = adapter.verifySignedWebhook({
      payload,
      signature: sign(payload),
      webhookSecret: secret,
    });

    expect(verified.verification).toBe("verified");
    if (verified.verification === "verified") {
      expect(verified.event).toMatchObject({
        customerId: "9001",
        entitlement: "ai.reference-task",
        entitlementStatus: "active",
        eventType: "subscription_updated",
        subscriptionId: "sub_123",
        workspaceId: "workspace_01",
      });
    }
  });

  it("uses the current subscription variant instead of stale checkout custom data", () => {
    const adapter = new LemonSqueezyBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload({ variant_id: 777 }));

    const verified = adapter.verifySignedWebhook({
      payload,
      signature: sign(payload),
      webhookSecret: secret,
    });

    expect(verified.verification).toBe("verified");
    if (verified.verification === "verified") {
      expect(verified.event.priceId).toBe("777");
    }
  });

  it("rejects invalid signatures and maps lifecycle statuses", () => {
    const adapter = new LemonSqueezyBillingAdapter(client());
    const payload = JSON.stringify(subscriptionPayload());

    expect(
      adapter.verifySignedWebhook({ payload, signature: "deadbeef", webhookSecret: secret })
        .verification,
    ).toBe("rejected");

    for (const [status, expected] of [
      ["on_trial", "trialing"],
      ["past_due", "past_due"],
      ["unpaid", "past_due"],
      ["cancelled", "inactive"],
      ["expired", "inactive"],
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
    const adapter = new LemonSqueezyBillingAdapter(client());
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
    const adapter = new LemonSqueezyBillingAdapter(client());
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
    const adapter = new LemonSqueezyBillingAdapter(client());
    expect(
      adapter.verifySignedWebhook(null as unknown as SignedStripeWebhookRequest).verification,
    ).toBe("rejected");
  });

  it("treats paid order_created events as active and ignores unrelated events", () => {
    const adapter = new LemonSqueezyBillingAdapter(client());
    const order = JSON.stringify({
      data: {
        attributes: {
          customer_id: 9001,
          status: "paid",
          updated_at: "2026-09-16T10:00:00.000Z",
        },
        id: "order_7",
        type: "orders",
      },
      meta: {
        custom_data: { entitlement: "ai.reference-task", workspaceId: "workspace_01" },
        event_name: "order_created",
      },
    });
    const verified = adapter.verifySignedWebhook({
      payload: order,
      signature: sign(order),
      webhookSecret: secret,
    });
    if (verified.verification === "verified") {
      expect(verified.event.entitlementStatus).toBe("active");
    }

    const ping = JSON.stringify({
      data: { attributes: {}, id: "1", type: "stores" },
      meta: { event_name: "store_updated" },
    });
    const ignored = adapter.verifySignedWebhook({
      payload: ping,
      signature: sign(ping),
      webhookSecret: secret,
    });
    if (ignored.verification === "verified") {
      expect(ignored.event.entitlementStatus).toBeNull();
    }
  });

  it("returns a customer portal session URL", async () => {
    const adapter = new LemonSqueezyBillingAdapter(client());
    const session = await adapter.createPortalSession({
      customerId: "9001",
      returnUrl: "https://app.test/billing",
      workspaceId: "workspace_01",
    });
    expect(session.url).toBe("https://store.lemonsqueezy.com/billing/portal");
  });
});
