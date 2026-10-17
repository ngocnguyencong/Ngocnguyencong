import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./auth-runtime", () => ({ database: {} }));
vi.mock("@supastack/db", () => ({ apiKey: {}, workspace: {} }));

import { hashApiKey } from "./api-keys";
import { createApiKeyResolver, type ApiKeyRecord } from "./api-key-auth";

const workspaceRow = Object.freeze({
  createdAt: new Date("2026-01-01T00:00:00Z"),
  name: "Acme",
  workspaceId: "ws_1",
});

function keyRecord(overrides: Partial<ApiKeyRecord> = {}): ApiKeyRecord {
  return {
    expiresAt: null,
    id: "key_1",
    revokedAt: null,
    scopes: ["read", "write"],
    userId: "user_1",
    workspaceId: "ws_1",
    ...overrides,
  };
}

function resolverWith(record: ApiKeyRecord | undefined) {
  const touchLastUsed = vi.fn(async () => {});
  const findKeyByHash = vi.fn(async () => record);
  const findWorkspace = vi.fn(async () => workspaceRow);
  const resolve = createApiKeyResolver({
    findKeyByHash,
    findWorkspace,
    now: () => new Date("2026-09-22T00:00:00Z"),
    touchLastUsed,
  });
  return { findKeyByHash, findWorkspace, resolve, touchLastUsed };
}

describe("createApiKeyResolver", () => {
  it("returns null when no Authorization header is present", async () => {
    const { resolve } = resolverWith(keyRecord());
    expect(await resolve(new Headers())).toBeNull();
  });

  it("rejects malformed and non-sk_ bearer tokens", async () => {
    const { resolve } = resolverWith(keyRecord());
    expect(await resolve(new Headers({ authorization: "Basic abc" }))).toBe("invalid");
    expect(await resolve(new Headers({ authorization: "Bearer pk_live_123" }))).toBe("invalid");
  });

  it("hashes the token, loads the workspace, and touches last-used for active keys", async () => {
    const token = "sk_test_abc123";
    const { findKeyByHash, findWorkspace, resolve, touchLastUsed } = resolverWith(keyRecord());

    const caller = await resolve(new Headers({ authorization: `Bearer ${token}` }));

    expect(findKeyByHash).toHaveBeenCalledWith(hashApiKey(token));
    expect(findWorkspace).toHaveBeenCalledWith("ws_1");
    expect(touchLastUsed).toHaveBeenCalledWith("key_1");
    expect(caller).toEqual({
      scopes: ["read", "write"],
      userId: "user_1",
      workspace: workspaceRow,
    });
  });

  it("rejects unknown, revoked, and expired keys", async () => {
    expect(
      await resolverWith(undefined).resolve(new Headers({ authorization: "Bearer sk_test_x" })),
    ).toBe("invalid");
    expect(
      await resolverWith(keyRecord({ revokedAt: new Date("2026-09-01T00:00:00Z") })).resolve(
        new Headers({ authorization: "Bearer sk_test_x" }),
      ),
    ).toBe("invalid");
    expect(
      await resolverWith(keyRecord({ expiresAt: new Date("2026-09-01T00:00:00Z") })).resolve(
        new Headers({ authorization: "Bearer sk_test_x" }),
      ),
    ).toBe("invalid");
  });

  it("rejects a key whose workspace is missing", async () => {
    const record = keyRecord();
    const resolve = createApiKeyResolver({
      findKeyByHash: async () => record,
      findWorkspace: async () => undefined,
      now: () => new Date(),
      touchLastUsed: async () => {},
    });
    expect(await resolve(new Headers({ authorization: "Bearer sk_test_x" }))).toBe("invalid");
  });
});
