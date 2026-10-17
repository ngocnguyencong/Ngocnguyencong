import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const API_KEY_SCOPES = ["read", "write"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export interface GeneratedApiKey {
  keyHash: string;
  plaintext: string;
  prefix: string;
}

export function generateApiKey(environment: string): GeneratedApiKey {
  const env = environment === "production" || environment === "live" ? "live" : "test";
  const plaintext = `sk_${env}_${randomBytes(24).toString("base64url")}`;
  return {
    keyHash: hashApiKey(plaintext),
    plaintext,
    prefix: plaintext.slice(0, 16),
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Constant-time hash comparison so prefix guessing cannot narrow the key space. */
export function verifyApiKey(plaintext: string, keyHash: string): boolean {
  const candidate = Buffer.from(hashApiKey(plaintext), "utf8");
  const stored = Buffer.from(keyHash, "utf8");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

export function parseApiKeyScopes(value: unknown): ApiKeyScope[] {
  if (!Array.isArray(value)) {
    return ["read"];
  }
  const scopes = value.filter(
    (entry): entry is ApiKeyScope =>
      typeof entry === "string" && (API_KEY_SCOPES as readonly string[]).includes(entry),
  );
  return scopes.length > 0 ? [...new Set(scopes)] : ["read"];
}

export function apiKeyStatus(
  record: { expiresAt: Date | null; revokedAt: Date | null },
  now: Date,
): "active" | "expired" | "revoked" {
  if (record.revokedAt !== null) {
    return "revoked";
  }
  if (record.expiresAt !== null && record.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "active";
}

export function isValidApiKeyName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 100;
}
