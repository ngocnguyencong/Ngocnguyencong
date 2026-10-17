import { describe, expect, it } from "vitest";

import {
  apiKeyStatus,
  generateApiKey,
  hashApiKey,
  isValidApiKeyName,
  parseApiKeyScopes,
  verifyApiKey,
} from "./api-keys";

describe("generateApiKey", () => {
  it("creates an env-prefixed key with display prefix and sha256 hash", () => {
    const key = generateApiKey("live");

    expect(key.plaintext).toMatch(/^sk_live_[A-Za-z0-9_-]{24,}$/);
    expect(key.prefix).toBe(key.plaintext.slice(0, 16));
    expect(key.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(key.keyHash).toBe(hashApiKey(key.plaintext));
    expect(key.plaintext).not.toBe(generateApiKey("live").plaintext);
  });
});

describe("verifyApiKey", () => {
  it("matches a stored sha256 hash for the exact plaintext only", () => {
    const { plaintext, keyHash } = generateApiKey("test");
    expect(verifyApiKey(plaintext, keyHash)).toBe(true);
    expect(verifyApiKey(`${plaintext}x`, keyHash)).toBe(false);
    expect(verifyApiKey("sk_test_nope", keyHash)).toBe(false);
  });
});

describe("parseApiKeyScopes", () => {
  it("accepts only known scopes and defaults to read", () => {
    expect(parseApiKeyScopes(["read", "write"])).toEqual(["read", "write"]);
    expect(parseApiKeyScopes(["read", "admin"])).toEqual(["read"]);
    expect(parseApiKeyScopes([])).toEqual(["read"]);
    expect(parseApiKeyScopes("write")).toEqual(["read"]);
  });
});

describe("apiKeyStatus", () => {
  const now = new Date("2026-09-16T00:00:00.000Z");

  it("reports revoked before expired", () => {
    expect(
      apiKeyStatus({ expiresAt: new Date("2020-01-01"), revokedAt: new Date("2026-01-01") }, now),
    ).toBe("revoked");
  });

  it("reports expired and active states", () => {
    expect(apiKeyStatus({ expiresAt: new Date("2020-01-01"), revokedAt: null }, now)).toBe(
      "expired",
    );
    expect(apiKeyStatus({ expiresAt: null, revokedAt: null }, now)).toBe("active");
    expect(apiKeyStatus({ expiresAt: new Date("2027-01-01"), revokedAt: null }, now)).toBe(
      "active",
    );
  });
});

describe("isValidApiKeyName", () => {
  it("requires a short non-empty label", () => {
    expect(isValidApiKeyName("CI deploy")).toBe(true);
    expect(isValidApiKeyName("")).toBe(false);
    expect(isValidApiKeyName("x".repeat(101))).toBe(false);
  });
});
