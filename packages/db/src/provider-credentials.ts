import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { providerCredential } from "./schema";
import type * as schema from "./schema";

const AES_256_GCM = "aes-256-gcm";
const ENVELOPE_VERSION = 1;

export interface ProviderCredentialScope {
  readonly provider: string;
  readonly workspaceId: string;
}

/**
 * A storage-only envelope. The API-key plaintext is intentionally absent.
 * It remains structurally compatible with @supastack/ai's KeyVaultRepository.
 */
export interface EncryptedProviderCredential extends ProviderCredentialScope {
  readonly algorithm: typeof AES_256_GCM;
  readonly authTag: string;
  readonly ciphertext: string;
  readonly iv: string;
  readonly version: typeof ENVELOPE_VERSION;
}

export interface ProviderCredentialRepository {
  delete(scope: ProviderCredentialScope): Promise<void>;
  get(scope: ProviderCredentialScope): Promise<EncryptedProviderCredential | null>;
  put(record: EncryptedProviderCredential): Promise<void>;
}

/**
 * Binds opaque BYOK envelopes to a concrete PostgreSQL database. This layer
 * never sees API-key plaintext: the AES-GCM key vault encrypts before `put`
 * and decrypts after `get`.
 */
export function createDrizzleProviderCredentialRepository(
  database: PostgresJsDatabase<typeof schema>,
): ProviderCredentialRepository {
  return Object.freeze({
    async delete(scope: ProviderCredentialScope) {
      const normalized = normalizeScope(scope);
      await database
        .delete(providerCredential)
        .where(
          and(
            eq(providerCredential.workspaceId, normalized.workspaceId),
            eq(providerCredential.provider, normalized.provider),
          ),
        );
    },
    async get(scope: ProviderCredentialScope) {
      const normalized = normalizeScope(scope);
      const [record] = await database
        .select({
          algorithm: providerCredential.algorithm,
          authTag: providerCredential.authTag,
          ciphertext: providerCredential.ciphertext,
          iv: providerCredential.iv,
          provider: providerCredential.provider,
          version: providerCredential.version,
          workspaceId: providerCredential.workspaceId,
        })
        .from(providerCredential)
        .where(
          and(
            eq(providerCredential.workspaceId, normalized.workspaceId),
            eq(providerCredential.provider, normalized.provider),
          ),
        )
        .limit(1);

      return record === undefined ? null : toEncryptedCredential(record);
    },
    async put(record: EncryptedProviderCredential) {
      const normalized = normalizeScope(record);
      const encrypted = requireEncryptedEnvelope(record, normalized);

      await database
        .insert(providerCredential)
        .values({
          algorithm: encrypted.algorithm,
          authTag: encrypted.authTag,
          ciphertext: encrypted.ciphertext,
          id: credentialId(normalized),
          iv: encrypted.iv,
          provider: normalized.provider,
          version: encrypted.version,
          workspaceId: normalized.workspaceId,
        })
        .onConflictDoUpdate({
          target: [providerCredential.workspaceId, providerCredential.provider],
          set: {
            algorithm: encrypted.algorithm,
            authTag: encrypted.authTag,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            version: encrypted.version,
            updatedAt: new Date(),
          },
        });
    },
  });
}

function credentialId(scope: ProviderCredentialScope): string {
  return `provider_credential:${scope.workspaceId}:${scope.provider}`;
}

function normalizeScope(scope: ProviderCredentialScope): ProviderCredentialScope {
  if (
    typeof scope.workspaceId !== "string" ||
    scope.workspaceId.trim().length === 0 ||
    typeof scope.provider !== "string" ||
    scope.provider.trim().length === 0 ||
    scope.provider.length > 64
  ) {
    throw new Error("A valid workspace and provider are required.");
  }

  return Object.freeze({ provider: scope.provider, workspaceId: scope.workspaceId });
}

function requireEncryptedEnvelope(
  record: EncryptedProviderCredential,
  scope: ProviderCredentialScope,
): EncryptedProviderCredential {
  if (
    record.algorithm !== AES_256_GCM ||
    record.version !== ENVELOPE_VERSION ||
    record.workspaceId !== scope.workspaceId ||
    record.provider !== scope.provider ||
    typeof record.iv !== "string" ||
    typeof record.authTag !== "string" ||
    typeof record.ciphertext !== "string"
  ) {
    throw new Error("A valid encrypted provider credential is required.");
  }

  return record;
}

function toEncryptedCredential(record: {
  algorithm: string;
  authTag: string;
  ciphertext: string;
  iv: string;
  provider: string;
  version: number;
  workspaceId: string;
}): EncryptedProviderCredential | null {
  if (
    record.algorithm !== AES_256_GCM ||
    record.version !== ENVELOPE_VERSION ||
    typeof record.iv !== "string" ||
    typeof record.authTag !== "string" ||
    typeof record.ciphertext !== "string"
  ) {
    return null;
  }

  return Object.freeze({
    algorithm: AES_256_GCM,
    authTag: record.authTag,
    ciphertext: record.ciphertext,
    iv: record.iv,
    provider: record.provider,
    version: ENVELOPE_VERSION,
    workspaceId: record.workspaceId,
  });
}
