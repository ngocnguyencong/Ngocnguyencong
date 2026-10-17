import { describe, expect, it, vi } from "vitest";
import {
  createMobilePurchasesBff,
  createRevenueCatWebhookHandler,
  parseRevenueCatAccess,
  purchaseCustomerId,
  purchaseWorkspaceId,
  verifyRevenueCatAuthorization,
  webhookCustomerIds,
} from "./mobile-purchases";

const now = new Date("2026-10-01T12:00:00Z");
function subscriber(expires: string | null = "2026-11-01T00:00:00Z", extra = {}) {
  return {
    subscriber: {
      entitlements: {
        pro: {
          expires_date: expires,
          product_identifier: "monthly",
        },
      },
      subscriptions: {
        monthly: {
          is_sandbox: false,
          refunded_at: null,
          grace_period_expires_date: null as string | null,
          ...extra,
        },
      },
      non_subscriptions: {},
    },
  };
}

describe("workspace purchase identity", () => {
  it("round-trips workspace IDs without treating them as credentials", () => {
    for (const id of ["workspace_a", "组织:42"]) {
      expect(purchaseWorkspaceId(purchaseCustomerId(id))).toBe(id);
    }
  });
  it.each(["$RCAnonymousID:123", "ssws_", "ssws_%%%%", "ssws_YQ==", "ssws_AA"])(
    "rejects unknown or malformed identity %s",
    (id) => {
      expect(purchaseWorkspaceId(id)).toBeNull();
    },
  );
});

describe("server verified access", () => {
  it("keeps the verified expiration date", () => {
    expect(parseRevenueCatAccess(subscriber(), "pro", false, now)).toEqual({
      active: true,
      expiresAt: new Date("2026-11-01T00:00:00Z"),
    });
  });
  it("denies expired and exactly-expiring access", () => {
    expect(parseRevenueCatAccess(subscriber(now.toISOString()), "pro", false, now).active).toBe(
      false,
    );
  });
  it("keeps a verified billing grace period", () => {
    const data = subscriber("2026-09-30T00:00:00Z");
    data.subscriber.subscriptions.monthly.grace_period_expires_date = "2026-10-03T00:00:00Z";
    expect(parseRevenueCatAccess(data, "pro", false, now)).toEqual({
      active: true,
      expiresAt: new Date("2026-10-03T00:00:00Z"),
    });
  });
  it("grants only the configured entitlement", () => {
    expect(parseRevenueCatAccess(subscriber(), "unknown", false, now).active).toBe(false);
  });
  it("denies sandbox purchases unless explicitly allowed", () => {
    const data = subscriber(undefined, { is_sandbox: true });
    expect(parseRevenueCatAccess(data, "pro", false, now).active).toBe(false);
    expect(parseRevenueCatAccess(data, "pro", true, now).active).toBe(true);
  });
  it("denies refunded purchases", () => {
    expect(
      parseRevenueCatAccess(
        subscriber(undefined, { refunded_at: now.toISOString() }),
        "pro",
        true,
        now,
      ).active,
    ).toBe(false);
  });
  it("accepts verified permanent non-subscription purchases", () => {
    const data = subscriber(null);
    data.subscriber.subscriptions = {} as never;
    data.subscriber.non_subscriptions = { monthly: [{ is_sandbox: false, refunded_at: null }] };
    expect(parseRevenueCatAccess(data, "pro", false, now)).toEqual({
      active: true,
      expiresAt: null,
    });
  });
  it("denies a refunded lifetime purchase when RevenueCat has revoked its entitlement", () => {
    const data = {
      subscriber: {
        entitlements: {},
        subscriptions: {},
        non_subscriptions: {
          lifetime: [
            {
              id: "purchase_1",
              is_sandbox: false,
              purchase_date: "2026-09-01T00:00:00Z",
              store: "app_store",
            },
          ],
        },
      },
    };
    expect(parseRevenueCatAccess(data, "pro", false, now)).toEqual({
      active: false,
      expiresAt: null,
    });
  });
  it.each([{}, { subscriber: {} }, subscriber("invalid")])(
    "rejects malformed provider data without granting access",
    (data) => {
      expect(() => parseRevenueCatAccess(data, "pro", false, now)).toThrow(
        "Purchase verification failed.",
      );
    },
  );
  it("requires store evidence rather than a forged entitlement alone", () => {
    const data = subscriber();
    data.subscriber.subscriptions = {} as never;
    expect(parseRevenueCatAccess(data, "pro", false, now).active).toBe(false);
  });
});

describe("purchase BFF", () => {
  function setup(role = "owner", configured = true) {
    const syncWorkspace = vi.fn(async () => ({ active: true }));
    const bff = createMobilePurchasesBff({
      entitlementId: configured ? "pro" : null,
      getSession: async () => ({ user: { id: "user_a" } }),
      resolveWorkspace: async () => ({ workspaceId: "workspace_a", role }),
      syncWorkspace,
    });
    return { bff, syncWorkspace };
  }
  it("returns only the server-selected active workspace customer", async () => {
    const { bff } = setup();
    expect(await bff.get(new Headers())).toEqual({
      status: 200,
      body: {
        data: {
          available: true,
          appUserId: purchaseCustomerId("workspace_a"),
          entitlementId: "pro",
          workspaceId: "workspace_a",
        },
      },
    });
  });
  it("keeps unconfigured and member clients unavailable", async () => {
    for (const { bff, syncWorkspace } of [setup("member"), setup("owner", false)]) {
      expect((await bff.get(new Headers())).body).toMatchObject({
        data: { available: false, appUserId: null, entitlementId: null },
      });
      expect((await bff.post(new Headers())).status).toBeGreaterThanOrEqual(400);
      expect(syncWorkspace).not.toHaveBeenCalled();
    }
  });
  it("reconciles only the server-selected workspace", async () => {
    const { bff, syncWorkspace } = setup("admin");
    expect(await bff.post(new Headers())).toEqual({
      status: 200,
      body: { data: { active: true, workspaceId: "workspace_a" } },
    });
    expect(syncWorkspace).toHaveBeenCalledExactlyOnceWith("workspace_a");
  });
  it("requires a session", async () => {
    const bff = createMobilePurchasesBff({
      entitlementId: "pro",
      getSession: async () => null,
      resolveWorkspace: vi.fn(),
      syncWorkspace: vi.fn(),
    });
    expect((await bff.get(new Headers())).status).toBe(401);
    expect((await bff.post(new Headers())).status).toBe(401);
  });
  it("hides provider and database failures", async () => {
    const bff = createMobilePurchasesBff({
      entitlementId: "pro",
      getSession: async () => {
        throw new Error("secret-key");
      },
      resolveWorkspace: vi.fn(),
      syncWorkspace: vi.fn(),
    });
    expect(JSON.stringify(await bff.post(new Headers()))).not.toContain("secret-key");
    expect((await bff.post(new Headers())).status).toBe(503);
  });
});

describe("RevenueCat webhook", () => {
  function handler() {
    const sync = vi.fn(async () => undefined);
    return {
      sync,
      handle: createRevenueCatWebhookHandler({
        authorization: "Bearer test-only-token",
        syncCustomer: sync,
      }),
    };
  }
  function request(body: unknown, authorization = "Bearer test-only-token") {
    return new Request("https://app.test/api/billing/webhook/revenuecat", {
      method: "POST",
      headers: { authorization },
      body: JSON.stringify(body),
    });
  }
  it("rejects unauthenticated requests before processing", async () => {
    const { handle, sync } = handler();
    expect((await handle(request({}, "wrong"))).status).toBe(401);
    expect(sync).not.toHaveBeenCalled();
  });
  it("re-fetches both transfer identities and handles duplicate deliveries safely", async () => {
    const { handle, sync } = handler();
    const a = purchaseCustomerId("a"),
      b = purchaseCustomerId("b");
    const event = {
      event: { id: "transfer", type: "TRANSFER", transferred_from: [a], transferred_to: [b] },
    };
    expect((await handle(request(event))).status).toBe(200);
    expect((await handle(request(event))).status).toBe(200);
    expect(sync.mock.calls).toEqual([[a], [b], [a], [b]]);
  });
  it("rejects oversized payloads and returns retryable provider failures", async () => {
    const { handle, sync } = handler();
    expect((await handle(request({ padding: "x".repeat(65_537) }))).status).toBe(413);
    sync.mockRejectedValueOnce(new Error("secret"));
    const response = await handle(
      request({ event: { id: "e", type: "RENEWAL", app_user_id: purchaseCustomerId("a") } }),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
  });
  it("requires the exact configured authorization", () => {
    expect(verifyRevenueCatAuthorization("Bearer test-only-token", "Bearer test-only-token")).toBe(
      true,
    );
    expect(verifyRevenueCatAuthorization("Bearer wrong", "Bearer test-only-token")).toBe(false);
    expect(verifyRevenueCatAuthorization(null, "Bearer test-only-token")).toBe(false);
    expect(verifyRevenueCatAuthorization("", "")).toBe(false);
  });
  it("includes transfer source and destination, deduplicating aliases", () => {
    const a = purchaseCustomerId("a"),
      b = purchaseCustomerId("b");
    expect(
      webhookCustomerIds({
        event: {
          id: "e",
          type: "TRANSFER",
          app_user_id: a,
          aliases: [a, "unknown"],
          transferred_from: [a],
          transferred_to: [b],
        },
      }),
    ).toEqual([a, b]);
  });
  it("ignores test events and rejects malformed events", () => {
    expect(webhookCustomerIds({ event: { id: "e", type: "TEST" } })).toEqual([]);
    expect(() => webhookCustomerIds({})).toThrow();
  });
});
