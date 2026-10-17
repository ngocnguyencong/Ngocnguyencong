import { describe, expect, it, vi } from "vitest";

import {
  createMobilePushTokensBff,
  type MobilePushTokenDependencies,
} from "./mobile-push-tokens-bff";

const token = {
  id: "dpt_1",
  lastSeenAt: "2026-10-10T00:00:00.000Z",
  platform: "ios" as const,
};

function makeBff(overrides: Partial<MobilePushTokenDependencies> = {}) {
  const deps: MobilePushTokenDependencies = {
    getSession: async () => ({ user: { id: "user-1" } }),
    listForUser: async () => [token],
    register: async () => token,
    resolveWorkspace: async () => ({ workspaceId: "ws-1" }),
    unregister: async () => true,
    ...overrides,
  };
  return { bff: createMobilePushTokensBff(deps), deps };
}

describe("mobile push tokens BFF list", () => {
  it("returns 401 without a session", async () => {
    const { bff } = makeBff({ getSession: async () => null });
    const response = await bff.list(new Headers());
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: "unauthorized", message: expect.any(String) },
    });
  });

  it("lists without resolving a workspace — tokens are user-scoped", async () => {
    const resolveWorkspace = vi.fn(async () => null);
    const { bff } = makeBff({ resolveWorkspace });
    const response = await bff.list(new Headers());
    expect(response.status).toBe(200);
    expect(resolveWorkspace).not.toHaveBeenCalled();
  });

  it("lists the caller's tokens", async () => {
    let seenUserId: string | undefined;
    const { bff } = makeBff({
      listForUser: async (userId) => {
        seenUserId = userId;
        return [token];
      },
    });
    const response = await bff.list(new Headers());
    expect(response.status).toBe(200);
    expect(seenUserId).toBe("user-1");
    expect(response.body).toEqual({ data: { tokens: [token] } });
  });
});

describe("mobile push tokens BFF register", () => {
  it("returns 401 without a session", async () => {
    const { bff } = makeBff({ getSession: async () => null });
    const response = await bff.register(new Headers(), {
      platform: "ios",
      token: "ExponentPushToken[abc]",
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the active workspace is not a membership-verified one", async () => {
    // A forged or stale active-workspace cookie surfaces as a null
    // resolution — registration must not stamp tokens onto it.
    const register = vi.fn(async () => token);
    const { bff } = makeBff({ register, resolveWorkspace: async () => null });
    const response = await bff.register(new Headers(), {
      platform: "ios",
      token: "ExponentPushToken[abc]",
    });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "noWorkspace", message: expect.any(String) },
    });
    expect(register).not.toHaveBeenCalled();
  });

  it("rejects invalid platform and token shapes with 422", async () => {
    const { bff } = makeBff();
    for (const input of [
      {},
      { platform: "windows", token: "ExponentPushToken[x]" },
      { platform: "ios" },
      { platform: "ios", token: "" },
      { platform: "ios", token: "   " },
      { platform: "ios", token: "t".repeat(256) },
      { platform: 5, token: "ExponentPushToken[x]" },
    ]) {
      const response = await bff.register(new Headers(), input);
      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        error: { code: "invalidInput", message: expect.any(String) },
      });
    }
  });

  it("registers under the session user and resolved workspace", async () => {
    let seen: Record<string, unknown> = {};
    const { bff } = makeBff({
      register: async (input) => {
        seen = { ...input };
        return token;
      },
    });
    const response = await bff.register(new Headers(), {
      platform: "ios",
      token: "ExponentPushToken[abc]",
    });
    expect(response.status).toBe(201);
    expect(seen).toEqual({
      platform: "ios",
      token: "ExponentPushToken[abc]",
      userId: "user-1",
      workspaceId: "ws-1",
    });
    expect(response.body).toEqual({ data: { token } });
  });
});

describe("mobile push tokens BFF unregister", () => {
  it("returns 401 without a session", async () => {
    const { bff } = makeBff({ getSession: async () => null });
    const response = await bff.unregister(new Headers(), { token: "ExponentPushToken[x]" });
    expect(response.status).toBe(401);
  });

  it("deletes without resolving a workspace — scoped to the session user", async () => {
    const resolveWorkspace = vi.fn(async () => null);
    const { bff } = makeBff({ resolveWorkspace });
    const response = await bff.unregister(new Headers(), {
      token: "ExponentPushToken[abc]",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { removed: true } });
    expect(resolveWorkspace).not.toHaveBeenCalled();
  });

  it("rejects a missing token with 422", async () => {
    const { bff } = makeBff();
    for (const input of [{}, { token: "" }, { token: 12 }]) {
      const response = await bff.unregister(new Headers(), input);
      expect(response.status).toBe(422);
    }
  });

  it("deletes scoped to the session user and reports whether a row was removed", async () => {
    let seen: Record<string, unknown> = {};
    const { bff } = makeBff({
      unregister: async (input) => {
        seen = { ...input };
        return false;
      },
    });
    const response = await bff.unregister(new Headers(), {
      token: "ExponentPushToken[abc]",
    });
    expect(response.status).toBe(200);
    expect(seen).toEqual({ token: "ExponentPushToken[abc]", userId: "user-1" });
    expect(response.body).toEqual({ data: { removed: false } });
  });
});
