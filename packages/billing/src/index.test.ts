import { describe, expect, test } from "vitest";

type BillingApi = {
  LocalBillingService: new () => {
    grantEntitlement(input: { workspaceId: string; key: string }): unknown;
    hasEntitlement(input: { workspaceId: string; key: string }): boolean;
    processWebhook(input: {
      workspaceId: string;
      id: string;
      verification: "verified" | "rejected";
      mutation: { type: "grant" | "revoke"; entitlement: string };
    }): { disposition: "processed" | "duplicate" | "rejected" };
  };
  StripeBillingAdapter: new (client: {
    checkout: {
      sessions: {
        create(
          input: {
            mode: "subscription";
            line_items: Array<{ price: string; quantity: 1 }>;
            success_url: string;
            cancel_url: string;
            client_reference_id: string;
            customer?: string;
            customer_email?: string;
            integration_identifier: string;
            metadata: { workspaceId: string; entitlement: string; priceId: string };
            subscription_data: {
              metadata: { workspaceId: string; entitlement: string; priceId: string };
            };
          },
          options?: { idempotencyKey: string },
        ): Promise<{ id: string; url: string | null }>;
      };
    };
    billingPortal: {
      sessions: {
        create(input: { customer: string; return_url: string }): Promise<{ url: string }>;
      };
    };
    webhooks: {
      constructEvent(
        payload: string,
        signature: string,
        secret: string,
      ): {
        created: number;
        id: string;
        type:
          | "checkout.session.completed"
          | "checkout.session.async_payment_succeeded"
          | "checkout.session.async_payment_failed"
          | "customer.subscription.created"
          | "customer.subscription.updated"
          | "customer.subscription.deleted"
          | "invoice.paid"
          | "invoice.payment_failed";
        data: {
          object: {
            id?: string;
            customerId?: string;
            subscriptionId?: string;
            paymentStatus?: string;
            status?: string;
            metadata: { workspaceId: string; entitlement: string; priceId?: string } | null;
          };
        };
      };
    };
  }) => {
    createCheckoutSession(input: {
      workspaceId: string;
      entitlement: string;
      priceId: string;
      successUrl: string;
      cancelUrl: string;
      customerId?: string;
      customerEmail?: string;
      idempotencyKey: string;
      integrationIdentifier: string;
    }): Promise<{ id: string; url: string | null }>;
    createPortalSession(input: {
      workspaceId: string;
      customerId: string;
      returnUrl: string;
    }): Promise<{ url: string }>;
    processSignedWebhook(
      input: { payload: string; signature: string; webhookSecret: string },
      ledger: {
        processWebhook(input: {
          workspaceId: string;
          id: string;
          verification: "verified" | "rejected";
          mutation: { type: "grant" | "revoke"; entitlement: string };
        }): { disposition: "processed" | "duplicate" | "rejected" };
      },
    ): { disposition: "processed" | "duplicate" | "ignored" | "rejected" };
    verifySignedWebhook(input: { payload: string; signature: string; webhookSecret: string }):
      | { verification: "rejected" }
      | {
          verification: "verified";
          event: {
            customerId?: string;
            entitlement?: string;
            entitlementStatus: "active" | "trialing" | "past_due" | "inactive" | null;
            eventId: string;
            eventType: string;
            occurredAt: Date;
            priceId?: string;
            subscriptionId?: string;
            workspaceId?: string;
          };
        };
  };
};

const billingApi = (await import("./index.js").catch(() => undefined)) as
  Partial<BillingApi> | undefined;

function createBillingService(): InstanceType<BillingApi["LocalBillingService"]> {
  expect(billingApi).toBeDefined();
  expect(billingApi).toHaveProperty("LocalBillingService");
  return new billingApi!.LocalBillingService!();
}

function createStripeBillingAdapter(
  client: ConstructorParameters<BillingApi["StripeBillingAdapter"]>[0],
): InstanceType<BillingApi["StripeBillingAdapter"]> {
  expect(billingApi).toBeDefined();
  expect(billingApi).toHaveProperty("StripeBillingAdapter");
  return new billingApi!.StripeBillingAdapter!(client);
}

describe("LocalBillingService", () => {
  test("keeps entitlements scoped to their workspace", () => {
    const billing = createBillingService();

    billing.grantEntitlement({
      workspaceId: "workspace-a",
      key: "ai.reference-task",
    });

    expect(
      billing.hasEntitlement({
        workspaceId: "workspace-a",
        key: "ai.reference-task",
      }),
    ).toBe(true);
    expect(
      billing.hasEntitlement({
        workspaceId: "workspace-b",
        key: "ai.reference-task",
      }),
    ).toBe(false);
  });

  test("applies a verified webhook event only once", () => {
    const billing = createBillingService();
    const event = {
      workspaceId: "workspace-a",
      id: "evt_123",
      verification: "verified" as const,
      mutation: { type: "grant" as const, entitlement: "ai.reference-task" },
    };

    expect(billing.processWebhook(event)).toEqual({ disposition: "processed" });
    expect(billing.processWebhook(event)).toEqual({ disposition: "duplicate" });
    expect(
      billing.hasEntitlement({
        workspaceId: "workspace-a",
        key: "ai.reference-task",
      }),
    ).toBe(true);
  });

  test("does not consume an idempotency key for a rejected delivery", () => {
    const billing = createBillingService();
    const rejectedEvent = {
      workspaceId: "workspace-a",
      id: "evt_456",
      verification: "rejected" as const,
      mutation: { type: "grant" as const, entitlement: "ai.reference-task" },
    };

    expect(billing.processWebhook(rejectedEvent)).toEqual({ disposition: "rejected" });
    expect(
      billing.hasEntitlement({
        workspaceId: "workspace-a",
        key: "ai.reference-task",
      }),
    ).toBe(false);
    expect(billing.processWebhook({ ...rejectedEvent, verification: "verified" })).toEqual({
      disposition: "processed",
    });
  });
});

describe("StripeBillingAdapter", () => {
  test("creates a subscription checkout session with workspace metadata", async () => {
    const requests: unknown[] = [];
    const billing = createStripeBillingAdapter({
      checkout: {
        sessions: {
          async create(input, options) {
            requests.push([input, options]);
            return { id: "cs_123", url: "https://checkout.stripe.test/cs_123" };
          },
        },
      },
      billingPortal: {
        sessions: {
          async create() {
            return { url: "unused" };
          },
        },
      },
      webhooks: {
        constructEvent() {
          throw new Error("unused");
        },
      },
    });

    await expect(
      billing.createCheckoutSession({
        workspaceId: "workspace-a",
        entitlement: "ai.reference-task",
        priceId: "price_monthly",
        successUrl: "https://app.example.test/billing/success",
        cancelUrl: "https://app.example.test/billing/cancel",
        customerId: "cus_123",
        idempotencyKey: "checkout_workspace_a_20260904",
        integrationIdentifier: "supastack_abcdefgh",
      }),
    ).resolves.toEqual({ id: "cs_123", url: "https://checkout.stripe.test/cs_123" });

    expect(requests).toEqual([
      [
        {
          mode: "subscription",
          line_items: [{ price: "price_monthly", quantity: 1 }],
          success_url: "https://app.example.test/billing/success",
          cancel_url: "https://app.example.test/billing/cancel",
          client_reference_id: "workspace-a",
          customer: "cus_123",
          integration_identifier: "supastack_abcdefgh",
          metadata: {
            workspaceId: "workspace-a",
            entitlement: "ai.reference-task",
            priceId: "price_monthly",
          },
          subscription_data: {
            metadata: {
              workspaceId: "workspace-a",
              entitlement: "ai.reference-task",
              priceId: "price_monthly",
            },
          },
        },
        { idempotencyKey: "checkout_workspace_a_20260904" },
      ],
    ]);
  });

  test("creates a customer billing portal session", async () => {
    const requests: unknown[] = [];
    const billing = createStripeBillingAdapter({
      checkout: {
        sessions: {
          async create() {
            return { id: "unused", url: null };
          },
        },
      },
      billingPortal: {
        sessions: {
          async create(input) {
            requests.push(input);
            return { url: "https://billing.stripe.test/session" };
          },
        },
      },
      webhooks: {
        constructEvent() {
          throw new Error("unused");
        },
      },
    });

    await expect(
      billing.createPortalSession({
        workspaceId: "workspace-a",
        customerId: "cus_123",
        returnUrl: "https://app.example.test/settings/billing",
      }),
    ).resolves.toEqual({ url: "https://billing.stripe.test/session" });

    expect(requests).toEqual([
      { customer: "cus_123", return_url: "https://app.example.test/settings/billing" },
    ]);
  });

  test("verifies a signed Stripe event before applying its entitlement mutation", () => {
    const calls: unknown[] = [];
    const billing = createStripeBillingAdapter({
      checkout: {
        sessions: {
          async create() {
            return { id: "unused", url: null };
          },
        },
      },
      billingPortal: {
        sessions: {
          async create() {
            return { url: "unused" };
          },
        },
      },
      webhooks: {
        constructEvent(payload, signature, secret) {
          calls.push([payload, signature, secret]);
          return {
            created: 1_788_523_200,
            id: "evt_123",
            type: "checkout.session.completed",
            data: {
              object: {
                customerId: "cus_123",
                metadata: { workspaceId: "workspace-a", entitlement: "ai.reference-task" },
                paymentStatus: "paid",
                subscriptionId: "sub_123",
              },
            },
          };
        },
      },
    });
    const ledger = createBillingService();

    expect(
      billing.processSignedWebhook(
        { payload: "{signed}", signature: "sig_123", webhookSecret: "whsec_123" },
        ledger,
      ),
    ).toEqual({ disposition: "processed" });
    expect(calls).toEqual([["{signed}", "sig_123", "whsec_123"]]);
    expect(ledger.hasEntitlement({ workspaceId: "workspace-a", key: "ai.reference-task" })).toBe(
      true,
    );
  });

  test("rejects an invalid signature without recording a webhook event", () => {
    const billing = createStripeBillingAdapter({
      checkout: {
        sessions: {
          async create() {
            return { id: "unused", url: null };
          },
        },
      },
      billingPortal: {
        sessions: {
          async create() {
            return { url: "unused" };
          },
        },
      },
      webhooks: {
        constructEvent() {
          throw new Error("invalid signature");
        },
      },
    });
    const ledger = createBillingService();

    expect(
      billing.processSignedWebhook(
        { payload: "{tampered}", signature: "bad", webhookSecret: "whsec_123" },
        ledger,
      ),
    ).toEqual({ disposition: "rejected" });
    expect(ledger.hasEntitlement({ workspaceId: "workspace-a", key: "ai.reference-task" })).toBe(
      false,
    );
  });

  test("normalizes signed subscription lifecycle events for durable persistence", () => {
    const billing = createStripeBillingAdapter({
      checkout: {
        sessions: {
          async create() {
            return { id: "unused", url: null };
          },
        },
      },
      billingPortal: {
        sessions: {
          async create() {
            return { url: "unused" };
          },
        },
      },
      webhooks: {
        constructEvent() {
          return {
            created: 1_788_523_200,
            id: "evt_subscription_updated",
            type: "customer.subscription.updated",
            data: {
              object: {
                customerId: "cus_123",
                id: "sub_123",
                metadata: {
                  entitlement: "ai.reference-task",
                  priceId: "price_monthly",
                  workspaceId: "workspace-a",
                },
                items: { data: [{ price: { id: "price_ultra" } }] },
                status: "past_due",
                subscriptionId: "sub_123",
              },
            },
          };
        },
      },
    });

    expect(
      billing.verifySignedWebhook({
        payload: "{signed}",
        signature: "sig_123",
        webhookSecret: "whsec_123",
      }),
    ).toEqual({
      verification: "verified",
      event: {
        customerId: "cus_123",
        entitlement: "ai.reference-task",
        entitlementStatus: "past_due",
        eventId: "evt_subscription_updated",
        eventType: "customer.subscription.updated",
        occurredAt: new Date("2026-09-04T12:00:00.000Z"),
        priceId: "price_ultra",
        subscriptionId: "sub_123",
        workspaceId: "workspace-a",
      },
    });
  });

  test("does not misreport an internal ledger failure as an invalid Stripe signature", () => {
    const billing = createStripeBillingAdapter({
      checkout: {
        sessions: {
          async create() {
            return { id: "unused", url: null };
          },
        },
      },
      billingPortal: {
        sessions: {
          async create() {
            return { url: "unused" };
          },
        },
      },
      webhooks: {
        constructEvent() {
          return {
            created: 1_788_523_200,
            id: "evt_ledger_failure",
            type: "checkout.session.completed",
            data: {
              object: {
                metadata: { workspaceId: "workspace-a", entitlement: "ai.reference-task" },
              },
            },
          };
        },
      },
    });
    const ledgerFailure = new Error("database unavailable");

    expect(() =>
      billing.processSignedWebhook(
        { payload: "{signed}", signature: "sig_123", webhookSecret: "whsec_123" },
        {
          processWebhook() {
            throw ledgerFailure;
          },
        },
      ),
    ).toThrow(ledgerFailure);
  });
});
