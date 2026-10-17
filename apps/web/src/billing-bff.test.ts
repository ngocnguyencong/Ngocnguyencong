import type { SignedStripeWebhookVerification } from "@supastack/billing";
import { describe, expect, it, vi } from "vitest";

import {
  createBillingBff,
  createStableCheckoutIdentity,
  type BillingBffDependencies,
} from "./billing-bff.js";

const trustedHeaders = new Headers({ origin: "https://app.example.test" });

function createDependencies(
  overrides: Partial<BillingBffDependencies> = {},
): BillingBffDependencies {
  return {
    applyStripeBillingEvent: vi.fn(async (input) => ({
      disposition: "processed" as const,
      workspaceId: input.workspaceId ?? "workspace-a",
    })),
    billing: {
      async createCheckoutSession() {
        return { id: "cs_123", url: "https://checkout.stripe.test/cs_123" };
      },
      async createPortalSession() {
        return { url: "https://billing.stripe.test/session" };
      },
      verifySignedWebhook(): SignedStripeWebhookVerification {
        return { verification: "rejected" };
      },
    },
    config: {
      appUrl: "https://app.example.test",
      entitlement: "ai.reference-task",
      priceId: "price_monthly",
      webhookSecret: "whsec_test",
    },
    createCheckoutIdentity: vi.fn(() => ({
      idempotencyKey: "checkout_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      integrationIdentifier: "supastack_abcdefgh",
    })),
    findBillingContext: async () => ({
      customerId: null,
      email: "member@example.test",
      role: "owner",
      workspaceId: "workspace-a",
    }),
    getSession: async () => ({ user: { id: "user-a" } }),
    now: () => new Date("2026-09-04T12:00:00.000Z"),
    ...overrides,
  };
}

describe("billing BFF", () => {
  it("creates Checkout from server-derived workspace and product configuration", async () => {
    const createCheckoutSession = vi.fn(async () => ({
      id: "cs_123",
      url: "https://checkout.stripe.test/cs_123",
    }));
    const dependencies = createDependencies({
      billing: {
        ...createDependencies().billing,
        createCheckoutSession,
      },
    });

    await expect(createBillingBff(dependencies).checkout(trustedHeaders)).resolves.toEqual({
      body: { data: { url: "https://checkout.stripe.test/cs_123" } },
      status: 200,
    });
    expect(createCheckoutSession).toHaveBeenCalledWith({
      cancelUrl: "https://app.example.test/billing?checkout=cancelled",
      customerEmail: "member@example.test",
      entitlement: "ai.reference-task",
      idempotencyKey: "checkout_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      integrationIdentifier: "supastack_abcdefgh",
      priceId: "price_monthly",
      successUrl: "https://app.example.test/billing?checkout=success",
      workspaceId: "workspace-a",
    });
  });

  it("reuses one stable identity for identical Checkout requests", async () => {
    const requests: unknown[] = [];
    const dependencies = createDependencies({
      billing: {
        ...createDependencies().billing,
        createCheckoutSession: vi.fn(async (request) => {
          requests.push(request);
          return { id: "cs_123", url: "https://checkout.stripe.test/cs_123" };
        }),
      },
    });
    const bff = createBillingBff(dependencies);

    await bff.checkout(trustedHeaders);
    await bff.checkout(trustedHeaders);

    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(dependencies.createCheckoutIdentity).toHaveBeenCalledTimes(2);
  });

  it("derives both Checkout identifiers from every provider request parameter", () => {
    const input = {
      cancelUrl: "https://app.example.test/billing?checkout=cancelled",
      customerEmail: " Member@Example.Test ",
      entitlement: "ai.reference-task",
      priceId: "price_monthly",
      successUrl: "https://app.example.test/billing?checkout=success",
      workspaceId: "workspace-a",
    };

    const first = createStableCheckoutIdentity(input);
    expect(createStableCheckoutIdentity({ ...input })).toEqual(first);
    expect(createStableCheckoutIdentity({ ...input, priceId: "price_changed" })).not.toEqual(first);
    expect(first.idempotencyKey).toMatch(/^checkout_[a-f0-9]{64}$/);
    expect(first.integrationIdentifier).toMatch(/^supastack_[a-z]{8}$/);
  });

  it("passes request headers into billing context resolution for active org cookies", async () => {
    const findBillingContext = vi.fn(async (_userId: string, headers: Headers) => {
      expect(headers.get("cookie")).toContain("supastack.activeWorkspaceId=ws_org");
      return {
        customerId: null,
        email: "member@example.test",
        role: "owner" as const,
        workspaceId: "ws_org",
      };
    });
    const createCheckoutSession = vi.fn(async () => ({
      id: "cs_active_org",
      url: "https://checkout.stripe.test/session",
    }));
    const bff = createBillingBff(
      createDependencies({
        billing: { ...createDependencies().billing, createCheckoutSession },
        findBillingContext,
      }),
    );

    const headers = new Headers(trustedHeaders);
    headers.set("cookie", "supastack.activeWorkspaceId=ws_org");
    headers.set("content-type", "application/json");

    await expect(bff.checkout(headers, { planId: "pro" })).resolves.toMatchObject({ status: 200 });
    expect(findBillingContext).toHaveBeenCalledWith("user-a", headers);
  });

  it("requires an authenticated workspace for Checkout", async () => {
    const bff = createBillingBff(createDependencies({ getSession: async () => null }));

    await expect(bff.checkout(trustedHeaders)).resolves.toMatchObject({ status: 401 });
  });

  it("opens Portal only for the current workspace's persisted customer", async () => {
    const createPortalSession = vi.fn(async () => ({
      url: "https://billing.stripe.test/session",
    }));
    const bff = createBillingBff(
      createDependencies({
        billing: { ...createDependencies().billing, createPortalSession },
        findBillingContext: async () => ({
          customerId: "cus_123",
          email: "member@example.test",
          role: "owner",
          workspaceId: "workspace-a",
        }),
      }),
    );

    await expect(bff.portal(trustedHeaders)).resolves.toEqual({
      body: { data: { url: "https://billing.stripe.test/session" } },
      status: 200,
    });
    expect(createPortalSession).toHaveBeenCalledWith({
      customerId: "cus_123",
      returnUrl: "https://app.example.test/billing",
      workspaceId: "workspace-a",
    });
  });

  it("refuses Portal before Stripe has created a workspace customer", async () => {
    const bff = createBillingBff(createDependencies());

    await expect(bff.portal(trustedHeaders)).resolves.toMatchObject({ status: 409 });
  });

  it.each(["guest", "member"] as const)(
    "denies %s billing checkout and portal before provider calls",
    async (role) => {
      const createCheckoutSession = vi.fn();
      const createPortalSession = vi.fn();
      const bff = createBillingBff(
        createDependencies({
          billing: { ...createDependencies().billing, createCheckoutSession, createPortalSession },
          findBillingContext: async () => ({
            customerId: "cus_123",
            email: "member@example.test",
            role,
            workspaceId: "workspace-a",
          }),
        }),
      );

      await expect(bff.checkout(trustedHeaders)).resolves.toMatchObject({ status: 403 });
      await expect(bff.portal(trustedHeaders)).resolves.toMatchObject({ status: 403 });
      expect(createCheckoutSession).not.toHaveBeenCalled();
      expect(createPortalSession).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid webhook signature before persistence", async () => {
    const applyStripeBillingEvent = vi.fn();
    const bff = createBillingBff(createDependencies({ applyStripeBillingEvent }));

    await expect(bff.webhook({ payload: "{}", signature: "invalid" })).resolves.toMatchObject({
      status: 400,
    });
    expect(applyStripeBillingEvent).not.toHaveBeenCalled();
  });

  it("awaits providers whose webhook verification is a server call", async () => {
    const applyStripeBillingEvent = vi.fn(async () => ({
      disposition: "processed" as const,
      workspaceId: "workspace-a",
    }));
    const bff = createBillingBff(
      createDependencies({
        applyStripeBillingEvent,
        billing: {
          ...createDependencies().billing,
          verifySignedWebhook: async () => ({
            event: {
              customerId: "PAYER42",
              entitlement: "ai.reference-task",
              entitlementStatus: "active",
              eventId: "WH-evt-1",
              eventType: "BILLING.SUBSCRIPTION.ACTIVATED",
              occurredAt: new Date("2026-09-04T11:59:00.000Z"),
              priceId: "P-123",
              subscriptionId: "I-ABC123",
              workspaceId: "workspace-a",
            },
            verification: "verified",
          }),
        },
      }),
    );

    await expect(
      bff.webhook({
        payload: '{"id":"WH-evt-1","event_type":"BILLING.SUBSCRIPTION.ACTIVATED"}',
        signature: "valid",
      }),
    ).resolves.toEqual({ body: { data: { disposition: "processed" } }, status: 200 });
    expect(applyStripeBillingEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "BILLING.SUBSCRIPTION.ACTIVATED" }),
    );
  });

  it("acknowledges valid irrelevant or unpaid events without changing access", async () => {
    const applyStripeBillingEvent = vi.fn();
    const bff = createBillingBff(
      createDependencies({
        applyStripeBillingEvent,
        billing: {
          ...createDependencies().billing,
          verifySignedWebhook: () => ({
            event: {
              entitlementStatus: null,
              eventId: "evt_unpaid",
              eventType: "checkout.session.completed",
              occurredAt: new Date("2026-09-04T11:59:00.000Z"),
            },
            verification: "verified",
          }),
        },
      }),
    );

    await expect(
      bff.webhook({ payload: '{"id":"evt_unpaid"}', signature: "valid" }),
    ).resolves.toEqual({ body: { data: { disposition: "ignored" } }, status: 200 });
    expect(applyStripeBillingEvent).not.toHaveBeenCalled();
  });

  it("persists a verified lifecycle event through the atomic repository command", async () => {
    const applyStripeBillingEvent = vi.fn(async () => ({
      disposition: "processed" as const,
      workspaceId: "workspace-a",
    }));
    const bff = createBillingBff(
      createDependencies({
        applyStripeBillingEvent,
        billing: {
          ...createDependencies().billing,
          verifySignedWebhook: () => ({
            event: {
              customerId: "cus_123",
              entitlement: "ai.reference-task",
              entitlementStatus: "active",
              eventId: "evt_123",
              eventType: "customer.subscription.updated",
              occurredAt: new Date("2026-09-04T11:59:00.000Z"),
              priceId: "price_monthly",
              subscriptionId: "sub_123",
              workspaceId: "workspace-a",
            },
            verification: "verified",
          }),
        },
      }),
    );

    await expect(
      bff.webhook({
        payload: '{"id":"evt_123","type":"customer.subscription.updated"}',
        signature: "valid",
      }),
    ).resolves.toEqual({ body: { data: { disposition: "processed" } }, status: 200 });
    expect(applyStripeBillingEvent).toHaveBeenCalledWith({
      customerId: "cus_123",
      entitlement: "ai.reference-task",
      entitlementStatus: "active",
      eventId: "evt_123",
      eventType: "customer.subscription.updated",
      occurredAt: new Date("2026-09-04T11:59:00.000Z"),
      // The minted request id rides inside the stored ledger payload so the
      // webhook_event row joins back to this request's other artifacts.
      payload: {
        correlationId: expect.stringMatching(/^corr_/),
        id: "evt_123",
        type: "customer.subscription.updated",
      },
      priceId: "price_monthly",
      provider: "stripe",
      subscriptionId: "sub_123",
      verifiedAt: new Date("2026-09-04T12:00:00.000Z"),
      workspaceId: "workspace-a",
    });
  });

  it("fires the entitlement-activated hook for processed active/trialing writes", async () => {
    const applyStripeBillingEvent = vi.fn(async () => ({
      disposition: "processed" as const,
      workspaceId: "workspace-a",
    }));
    const onEntitlementActivated = vi.fn(async () => undefined);
    type EntitlementStatus = "active" | "inactive" | "past_due" | "trialing";
    const verifySignedWebhook = (status: EntitlementStatus) => () => ({
      event: {
        entitlement: "ai.reference-task",
        entitlementStatus: status,
        eventId: `evt_${status}`,
        eventType: "customer.subscription.updated",
        occurredAt: new Date("2026-09-04T11:59:00.000Z"),
        subscriptionId: "sub_123",
        workspaceId: "workspace-a",
      },
      verification: "verified" as const,
    });
    const bff = (status: EntitlementStatus) =>
      createBillingBff(
        createDependencies({
          applyStripeBillingEvent,
          billing: {
            ...createDependencies().billing,
            verifySignedWebhook: verifySignedWebhook(status),
          },
          onEntitlementActivated,
        }),
      );

    await bff("active").webhook({ payload: '{"id":"evt_a"}', signature: "valid" });
    expect(onEntitlementActivated).toHaveBeenCalledWith({
      entitlementKey: "ai.reference-task",
      eventId: "evt_active",
      status: "active",
      subscriptionId: "sub_123",
      workspaceId: "workspace-a",
    });

    onEntitlementActivated.mockClear();
    await bff("trialing").webhook({ payload: '{"id":"evt_t"}', signature: "valid" });
    expect(onEntitlementActivated).toHaveBeenCalledWith(
      expect.objectContaining({ status: "trialing" }),
    );

    for (const status of ["past_due", "inactive"] as const) {
      onEntitlementActivated.mockClear();
      await bff(status).webhook({ payload: `{"id":"evt_${status}"}`, signature: "valid" });
      expect(onEntitlementActivated).not.toHaveBeenCalled();
    }
  });

  it("threads the route-minted correlationId into the ledger payload and emit context", async () => {
    const applyStripeBillingEvent = vi.fn(async () => ({
      disposition: "processed" as const,
      workspaceId: "workspace-a",
    }));
    const onBillingLifecycleProcessed = vi.fn(async () => undefined);
    const bff = createBillingBff(
      createDependencies({
        applyStripeBillingEvent,
        billing: {
          ...createDependencies().billing,
          verifySignedWebhook: () => ({
            event: {
              customerId: "cus_123",
              entitlement: "ai.reference-task",
              entitlementStatus: "active",
              eventId: "evt_123",
              eventType: "customer.subscription.updated",
              occurredAt: new Date("2026-09-04T11:59:00.000Z"),
              priceId: "price_monthly",
              subscriptionId: "sub_123",
              workspaceId: "workspace-a",
            },
            verification: "verified",
          }),
        },
        onBillingLifecycleProcessed,
      }),
    );

    await bff.webhook({
      correlationId: "corr_req-1",
      payload: '{"id":"evt_123","type":"customer.subscription.updated"}',
      signature: "valid",
    });

    expect(applyStripeBillingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ correlationId: "corr_req-1" }),
      }),
    );
    expect(onBillingLifecycleProcessed).toHaveBeenCalledWith(
      { type: "billing.checkout_succeeded", workspaceId: "workspace-a" },
      { correlationId: "corr_req-1" },
    );
  });

  it("mints a distinct correlationId per webhook call when the route omits one", async () => {
    const ledgerPayloads: Record<string, unknown>[] = [];
    const bff = createBillingBff(
      createDependencies({
        applyStripeBillingEvent: vi.fn(async (input) => {
          ledgerPayloads.push(input.payload as Record<string, unknown>);
          return { disposition: "processed" as const, workspaceId: "workspace-a" };
        }),
        billing: {
          ...createDependencies().billing,
          verifySignedWebhook: () => ({
            event: {
              customerId: "cus_123",
              entitlement: "ai.reference-task",
              entitlementStatus: "active",
              eventId: "evt_seq",
              eventType: "customer.subscription.updated",
              occurredAt: new Date("2026-09-04T11:59:00.000Z"),
              priceId: "price_monthly",
              subscriptionId: "sub_123",
              workspaceId: "workspace-a",
            },
            verification: "verified",
          }),
        },
      }),
    );

    await bff.webhook({ payload: '{"id":"evt_seq"}', signature: "valid" });
    await bff.webhook({ payload: '{"id":"evt_seq"}', signature: "valid" });

    expect(ledgerPayloads).toHaveLength(2);
    for (const payload of ledgerPayloads) {
      expect(payload.correlationId).toEqual(expect.stringMatching(/^corr_/));
    }
    expect(ledgerPayloads[0]!.correlationId).not.toBe(ledgerPayloads[1]!.correlationId);
  });

  it("drops a malformed caller correlationId and mints a fresh one", async () => {
    const applyStripeBillingEvent = vi.fn(async () => ({
      disposition: "processed" as const,
      workspaceId: "workspace-a",
    }));
    const bff = createBillingBff(
      createDependencies({
        applyStripeBillingEvent,
        billing: {
          ...createDependencies().billing,
          verifySignedWebhook: () => ({
            event: {
              customerId: "cus_123",
              entitlement: "ai.reference-task",
              entitlementStatus: "active",
              eventId: "evt_123",
              eventType: "customer.subscription.updated",
              occurredAt: new Date("2026-09-04T11:59:00.000Z"),
              priceId: "price_monthly",
              subscriptionId: "sub_123",
              workspaceId: "workspace-a",
            },
            verification: "verified",
          }),
        },
      }),
    );

    await bff.webhook({
      correlationId: "",
      payload: '{"id":"evt_123"}',
      signature: "valid",
    });

    expect(applyStripeBillingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          correlationId: expect.stringMatching(/^corr_[0-9a-f-]+$/),
        }),
      }),
    );
  });

  it("emits an in-app billing notification after a processed lifecycle write", async () => {
    const onBillingLifecycleProcessed = vi.fn(async () => undefined);
    const bff = createBillingBff(
      createDependencies({
        applyStripeBillingEvent: vi.fn(async () => ({
          disposition: "processed" as const,
          workspaceId: "workspace-a",
        })),
        billing: {
          ...createDependencies().billing,
          verifySignedWebhook: () => ({
            event: {
              customerId: "cus_123",
              entitlement: "ai.reference-task",
              entitlementStatus: "past_due",
              eventId: "evt_past_due",
              eventType: "invoice.payment_failed",
              occurredAt: new Date("2026-09-04T11:59:00.000Z"),
              workspaceId: "workspace-a",
            },
            verification: "verified",
          }),
        },
        onBillingLifecycleProcessed,
      }),
    );

    await expect(
      bff.webhook({
        payload: '{"id":"evt_past_due","type":"invoice.payment_failed"}',
        signature: "valid",
      }),
    ).resolves.toEqual({ body: { data: { disposition: "processed" } }, status: 200 });
    expect(onBillingLifecycleProcessed).toHaveBeenCalledWith(
      {
        type: "billing.payment_failed",
        workspaceId: "workspace-a",
      },
      { correlationId: expect.stringMatching(/^corr_/) },
    );
  });

  it("skips notification fan-out for duplicate lifecycle writes", async () => {
    const onBillingLifecycleProcessed = vi.fn(async () => undefined);
    const bff = createBillingBff(
      createDependencies({
        applyStripeBillingEvent: vi.fn(async () => ({
          disposition: "duplicate" as const,
          workspaceId: "workspace-a",
        })),
        billing: {
          ...createDependencies().billing,
          verifySignedWebhook: () => ({
            event: {
              entitlementStatus: "active",
              eventId: "evt_dup",
              eventType: "checkout.session.completed",
              occurredAt: new Date("2026-09-04T11:59:00.000Z"),
              workspaceId: "workspace-a",
            },
            verification: "verified",
          }),
        },
        onBillingLifecycleProcessed,
      }),
    );

    await bff.webhook({ payload: '{"id":"evt_dup"}', signature: "valid" });
    expect(onBillingLifecycleProcessed).not.toHaveBeenCalled();
  });

  it("re-fires the idempotent credit hook on duplicate replays so failed grants heal", async () => {
    // If onEntitlementActivated threw after the ledger commit on the first
    // delivery, the provider's retry arrives as "duplicate" — the hook must
    // fire again (its own reference dedupe makes the replay safe) or the paid
    // credits are silently lost.
    const onEntitlementActivated = vi.fn(async () => undefined);
    const onBillingLifecycleProcessed = vi.fn(async () => undefined);
    const bff = createBillingBff(
      createDependencies({
        applyStripeBillingEvent: vi.fn(async () => ({
          disposition: "duplicate" as const,
          workspaceId: "workspace-a",
        })),
        billing: {
          ...createDependencies().billing,
          verifySignedWebhook: () => ({
            event: {
              entitlement: "ai.reference-task",
              entitlementStatus: "active",
              eventId: "evt_dup",
              eventType: "checkout.session.completed",
              occurredAt: new Date("2026-09-04T11:59:00.000Z"),
              subscriptionId: "sub_123",
              workspaceId: "workspace-a",
            },
            verification: "verified",
          }),
        },
        onBillingLifecycleProcessed,
        onEntitlementActivated,
      }),
    );

    await bff.webhook({ payload: '{"id":"evt_dup"}', signature: "valid" });
    expect(onEntitlementActivated).toHaveBeenCalledWith({
      entitlementKey: "ai.reference-task",
      eventId: "evt_dup",
      status: "active",
      subscriptionId: "sub_123",
      workspaceId: "workspace-a",
    });
    expect(onBillingLifecycleProcessed).not.toHaveBeenCalled();
  });

  it("lets persistence failures escape so Stripe retries", async () => {
    const databaseFailure = new Error("database unavailable");
    const bff = createBillingBff(
      createDependencies({
        applyStripeBillingEvent: async () => {
          throw databaseFailure;
        },
        billing: {
          ...createDependencies().billing,
          verifySignedWebhook: () => ({
            event: {
              customerId: "cus_123",
              entitlement: "ai.reference-task",
              entitlementStatus: "active",
              eventId: "evt_123",
              eventType: "customer.subscription.updated",
              occurredAt: new Date("2026-09-04T11:59:00.000Z"),
              priceId: "price_monthly",
              subscriptionId: "sub_123",
              workspaceId: "workspace-a",
            },
            verification: "verified",
          }),
        },
      }),
    );

    await expect(bff.webhook({ payload: '{"id":"evt_123"}', signature: "valid" })).rejects.toBe(
      databaseFailure,
    );
  });
});
