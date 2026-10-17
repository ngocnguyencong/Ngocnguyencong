import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { encodeStandardWebhookSignature } from "./standard-webhooks";
import { WHOP_MEMBERSHIP_MANAGE_URL, WhopBillingAdapter, type WhopBillingClient } from "./whop";

const secret = "ws_test_secret";

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

function paymentPayload(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    data: {
      id: "pay_123",
      membership_id: "mem_555",
      metadata: {
        entitlement: "ai.reference-task",
        priceId: "plan_555",
        workspaceId: "workspace_01",
      },
      ...overrides,
    },
    id: "evt_123",
    timestamp: "2026-09-22T00:00:00.000Z",
    type: "payment.succeeded",
  };
}

function membershipPayload(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    data: {
      id: "mem_555",
      metadata: {
        entitlement: "ai.reference-task",
        priceId: "plan_555",
        workspaceId: "workspace_01",
      },
      status: "active",
      ...overrides,
    },
    id: "evt_124",
    timestamp: "2026-09-22T00:00:00.000Z",
    type: "membership.activated",
  };
}

function client(overrides: Partial<WhopBillingClient> = {}): WhopBillingClient {
  return {
    async createCheckoutConfiguration() {
      return { id: "ch_1", url: "https://whop.com/checkout/abc" };
    },
    async retrieveMembership() {
      return { manageUrl: "https://whop.com/billing/manage/mem_555" };
    },
    unwrapWebhook(body, headers, webhookSecret) {
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

describe("WhopBillingAdapter", () => {
  it("creates a checkout configuration with plan, metadata and redirect", async () => {
    let captured: unknown;
    const adapter = new WhopBillingAdapter(
      client({
        async createCheckoutConfiguration(input) {
          captured = input;
          return { id: "ch_1", url: "https://whop.com/checkout/abc" };
        },
      }),
    );

    const session = await adapter.createCheckoutSession({
      cancelUrl: "https://app.test/billing?checkout=cancelled",
      customerEmail: "buyer@example.test",
      entitlement: "ai.reference-task",
      idempotencyKey: "checkout_abc",
      integrationIdentifier: "supastack_abcd",
      priceId: "plan_555",
      successUrl: "https://app.test/billing?checkout=success",
      workspaceId: "workspace_01",
    });

    expect(session.url).toBe("https://whop.com/checkout/abc");
    expect(captured).toMatchObject({
      metadata: {
        entitlement: "ai.reference-task",
        priceId: "plan_555",
        workspaceId: "workspace_01",
      },
      planId: "plan_555",
      redirectUrl: "https://app.test/billing?checkout=success",
    });
  });

  it("verifies Standard Webhooks signatures and maps the membership to the customer", () => {
    const adapter = new WhopBillingAdapter(client());
    const payload = JSON.stringify(paymentPayload());

    const verified = adapter.verifySignedWebhook({
      payload,
      signature: signatureFor(payload),
      webhookSecret: secret,
    });

    expect(verified.verification).toBe("verified");
    if (verified.verification === "verified") {
      expect(verified.event).toMatchObject({
        customerId: "mem_555",
        entitlement: "ai.reference-task",
        entitlementStatus: "active",
        eventId: "evt_123",
        eventType: "payment.succeeded",
        priceId: "plan_555",
        subscriptionId: "mem_555",
        workspaceId: "workspace_01",
      });
    }
  });

  it("uses the current membership plan instead of stale checkout metadata", () => {
    const adapter = new WhopBillingAdapter(client());
    const payload = JSON.stringify(membershipPayload({ plan_id: "plan_ultra" }));

    const verified = adapter.verifySignedWebhook({
      payload,
      signature: signatureFor(payload),
      webhookSecret: secret,
    });

    expect(verified.verification).toBe("verified");
    if (verified.verification === "verified") {
      expect(verified.event.priceId).toBe("plan_ultra");
    }
  });

  it("rejects invalid signatures and maps lifecycle events", () => {
    const adapter = new WhopBillingAdapter(client());
    const payload = JSON.stringify(paymentPayload());

    expect(
      adapter.verifySignedWebhook({ payload, signature: "deadbeef", webhookSecret: secret })
        .verification,
    ).toBe("rejected");

    for (const [build, eventType, expected] of [
      [paymentPayload, "payment.succeeded", "active"],
      [paymentPayload, "invoice.paid", "active"],
      [paymentPayload, "payment.failed", "past_due"],
      [paymentPayload, "invoice.past_due", "past_due"],
      [paymentPayload, "refund.created", "inactive"],
      [membershipPayload, "membership.activated", "active"],
      [membershipPayload, "membership.deactivated", "inactive"],
      [membershipPayload, "membership.cancel_at_period_end_changed", null],
      [paymentPayload, "product.updated", null],
    ] as const) {
      const parsed = JSON.parse(JSON.stringify(build())) as { type: string };
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

  it("returns the membership manage_url for the portal session", async () => {
    let capturedId: string | undefined;
    const adapter = new WhopBillingAdapter(
      client({
        async retrieveMembership(membershipId) {
          capturedId = membershipId;
          return { manageUrl: "https://whop.com/billing/manage/mem_555" };
        },
      }),
    );
    const session = await adapter.createPortalSession({
      customerId: "mem_555",
      returnUrl: "https://app.test/billing",
      workspaceId: "workspace_01",
    });
    expect(capturedId).toBe("mem_555");
    expect(session.url).toBe("https://whop.com/billing/manage/mem_555");
  });

  it("falls back to the documented membership page when manage_url is absent", async () => {
    const adapter = new WhopBillingAdapter(
      client({
        async retrieveMembership() {
          return { manageUrl: null };
        },
      }),
    );
    const session = await adapter.createPortalSession({
      customerId: "mem_555",
      returnUrl: "https://app.test/billing",
      workspaceId: "workspace_01",
    });
    expect(session.url).toBe(WHOP_MEMBERSHIP_MANAGE_URL);
  });
});
