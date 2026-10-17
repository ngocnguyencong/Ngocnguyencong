import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  writes: [] as Record<string, unknown>[],
  execute: vi.fn(),
  role: "owner",
}));
vi.mock("server-only", () => ({}));
vi.mock("@supastack/config", () => ({
  parseServerConfig: () => ({
    mobilePurchases: {
      kind: "revenuecat",
      secretApiKey: "test-only-server-key",
      webhookAuthorization: "Bearer test-only-webhook",
      entitlementId: "pro",
      entitlementKey: "ai.reference-task",
      allowSandbox: false,
    },
  }),
}));
vi.mock("./rate-limit-runtime", () => ({
  createNamedRateLimiter: () => ({ check: async () => ({ allowed: true }) }),
}));
vi.mock("./mobile-workspace-context", () => ({
  resolveMobileWorkspaceContext: async () => ({ workspaceId: "workspace_a", role: state.role }),
}));
vi.mock("./auth-runtime", () => ({
  getAuthSession: async () => ({ user: { id: "user_a" } }),
  database: {
    transaction: async (callback: (transaction: unknown) => unknown) =>
      callback({
        execute: state.execute,
        insert: () => ({
          values: (values: Record<string, unknown>) => ({
            onConflictDoUpdate: async () => {
              state.writes.push(values);
            },
          }),
        }),
      }),
  },
}));

import { POST } from "../app/api/mobile/purchases/sync/route";

beforeEach(() => {
  state.writes.length = 0;
  state.role = "owner";
  state.fetch.mockReset();
  state.execute.mockClear();
  vi.stubGlobal("fetch", state.fetch);
});

it("verifies and persists only the authenticated workspace's RevenueCat grant", async () => {
  state.fetch.mockResolvedValue(
    Response.json({
      subscriber: {
        entitlements: {
          pro: { product_identifier: "monthly", expires_date: "2099-01-01T00:00:00Z" },
        },
        subscriptions: { monthly: { is_sandbox: false, refunded_at: null } },
        non_subscriptions: {},
      },
    }),
  );
  const request = new Request("https://app.test/api/mobile/purchases/sync", {
    method: "POST",
    body: JSON.stringify({ workspaceId: "other", active: true, entitlementId: "admin" }),
  });
  const response = await POST(request);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { active: true, workspaceId: "workspace_a" } });
  expect(state.fetch.mock.calls[0]![0]).toBe(
    "https://api.revenuecat.com/v1/subscribers/ssws_d29ya3NwYWNlX2E",
  );
  expect(state.fetch.mock.calls[0]![1]).toMatchObject({
    headers: { authorization: "Bearer test-only-server-key" },
    redirect: "error",
    cache: "no-store",
  });
  expect(state.execute).toHaveBeenCalledOnce();
  expect(state.writes).toEqual([
    expect.objectContaining({
      workspaceId: "workspace_a",
      source: "revenuecat",
      key: "ai.reference-task",
      status: "active",
      expiresAt: new Date("2099-01-01T00:00:00Z"),
    }),
  ]);
});

it("leaves verified grants untouched when the provider fails", async () => {
  state.fetch.mockResolvedValue(new Response("secret-provider-error", { status: 500 }));
  const response = await POST(
    new Request("https://app.test/api/mobile/purchases/sync", { method: "POST" }),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret-provider-error");
  expect(state.writes).toEqual([]);
});

it("blocks members before any provider call", async () => {
  state.role = "member";
  expect(
    (await POST(new Request("https://app.test/api/mobile/purchases/sync", { method: "POST" })))
      .status,
  ).toBe(403);
  expect(state.fetch).not.toHaveBeenCalled();
  expect(state.writes).toEqual([]);
});
