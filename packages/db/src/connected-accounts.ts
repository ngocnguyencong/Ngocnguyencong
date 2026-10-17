import { and, asc, eq, isNotNull, lt } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  AES_256_GCM,
  ENVELOPE_VERSION,
  type ConnectedAccountTokenEnvelope,
} from "./connected-account-vault";
import { connectedAccount } from "./schema";
import type * as schema from "./schema";

const CONNECTED_ACCOUNT_STATUSES = ["active", "needs_reauth", "revoked"] as const;
export type ConnectedAccountStatus = (typeof CONNECTED_ACCOUNT_STATUSES)[number];

/**
 * Known providers ("x" | "google" | "microsoft" | "smtp") — the column is a
 * varchar so new providers need no migration; the union keeps autocomplete.
 */
export type ConnectedAccountProvider = "google" | "microsoft" | "smtp" | "x" | (string & {});

/** Row shape with `status` narrowed to the known set for consumers. */
export type ConnectedAccount = Omit<typeof connectedAccount.$inferSelect, "status"> & {
  readonly status: ConnectedAccountStatus;
};

export interface PutConnectedAccountInput {
  /**
   * Defaults to `connected_account:{workspaceId}:{provider}:{externalAccountId}`;
   * the identity components must not contain ":" while it is generated.
   */
  readonly id?: string;
  readonly workspaceId: string;
  readonly provider: ConnectedAccountProvider;
  readonly externalAccountId: string;
  readonly label?: string | null;
  readonly scopes?: readonly string[] | null;
  readonly status?: ConnectedAccountStatus;
  /**
   * Reason carried with `status`, mirroring `updateStatus`: writing "active"
   * clears it, non-active statuses store it (null/omitted clears). A reason
   * without a status writes just the reason on conflict.
   */
  readonly failureReason?: string | null;
  /**
   * Encrypted envelope from `connected-account-vault`. Omit for pending rows;
   * pass null to clear the stored token columns.
   */
  readonly tokens?: ConnectedAccountTokenEnvelope | null;
  readonly accessTokenExpiresAt?: Date | null;
  readonly lastRefreshedAt?: Date | null;
}

export interface UpdateConnectedAccountTokensInput {
  readonly tokens: ConnectedAccountTokenEnvelope;
  /** Omit to keep the stored expiry; pass null to clear it. */
  readonly accessTokenExpiresAt?: Date | null;
  /** Defaults to now. */
  readonly lastRefreshedAt?: Date;
}

/**
 * Workspace-scoped storage for connected external accounts. Storage-only:
 * token material arrives as an opaque AES-GCM envelope (see
 * `connected-account-vault.ts`) — this layer never sees plaintext.
 */
export interface ConnectedAccountRepository {
  /** Hard delete — disconnecting an account removes the row entirely. */
  delete(workspaceId: string, id: string): Promise<void>;
  get(workspaceId: string, id: string): Promise<ConnectedAccount | null>;
  getByExternalId(
    workspaceId: string,
    provider: ConnectedAccountProvider,
    externalAccountId: string,
  ): Promise<ConnectedAccount | null>;
  list(workspaceId: string): Promise<ConnectedAccount[]>;
  listByProvider(
    workspaceId: string,
    provider: ConnectedAccountProvider,
  ): Promise<ConnectedAccount[]>;
  /**
   * Active accounts whose access token expires before `before`, oldest
   * expiry first. `needs_reauth`/`revoked` rows, rows without an expiry
   * (smtp/pending), and rows without stored tokens are skipped — the
   * refresh sweep can only act on live, expiring tokens.
   */
  listExpiring(before: Date, limit: number): Promise<ConnectedAccount[]>;
  /** Upsert on the (workspaceId, provider, externalAccountId) identity. */
  put(input: PutConnectedAccountInput): Promise<ConnectedAccount>;
  /**
   * Writes status + failureReason as one unit — "active" clears the reason,
   * "needs_reauth"/"revoked" carry it.
   */
  updateStatus(
    workspaceId: string,
    id: string,
    status: ConnectedAccountStatus,
    failureReason?: string | null,
  ): Promise<void>;
  /**
   * Stores a fresh token envelope and marks the account healthy: status →
   * "active", failureReason cleared, lastRefreshedAt stamped. Only an
   * `active` row absorbs the write — a `needs_reauth`/`revoked`/missing row
   * is a no-op that resolves `false`, so a token refresh can never
   * resurrect a dead or flagged account.
   */
  updateTokens(
    workspaceId: string,
    id: string,
    input: UpdateConnectedAccountTokensInput,
  ): Promise<boolean>;
}

export function createDrizzleConnectedAccountRepository(
  database: PostgresJsDatabase<typeof schema>,
): ConnectedAccountRepository {
  return Object.freeze({
    async delete(workspaceId: string, id: string) {
      const scoped = normalizeRowScope(workspaceId, id);
      await database
        .delete(connectedAccount)
        .where(
          and(
            eq(connectedAccount.workspaceId, scoped.workspaceId),
            eq(connectedAccount.id, scoped.id),
          ),
        );
    },

    async get(workspaceId: string, id: string) {
      const scoped = normalizeRowScope(workspaceId, id);
      const [record] = await database
        .select()
        .from(connectedAccount)
        .where(
          and(
            eq(connectedAccount.workspaceId, scoped.workspaceId),
            eq(connectedAccount.id, scoped.id),
          ),
        )
        .limit(1);
      return (record ?? null) as ConnectedAccount | null;
    },

    async getByExternalId(
      workspaceId: string,
      provider: ConnectedAccountProvider,
      externalAccountId: string,
    ) {
      const identity = normalizeIdentity({ externalAccountId, provider, workspaceId });
      const [record] = await database
        .select()
        .from(connectedAccount)
        .where(
          and(
            eq(connectedAccount.workspaceId, identity.workspaceId),
            eq(connectedAccount.provider, identity.provider),
            eq(connectedAccount.externalAccountId, identity.externalAccountId),
          ),
        )
        .limit(1);
      return (record ?? null) as ConnectedAccount | null;
    },

    async list(workspaceId: string) {
      const normalized = normalizeWorkspaceId(workspaceId);
      const rows = await database
        .select()
        .from(connectedAccount)
        .where(eq(connectedAccount.workspaceId, normalized))
        .orderBy(asc(connectedAccount.createdAt), asc(connectedAccount.id));
      return rows as ConnectedAccount[];
    },

    async listByProvider(workspaceId: string, provider: ConnectedAccountProvider) {
      const normalized = normalizeWorkspaceId(workspaceId);
      const normalizedProvider = normalizeProvider(provider);
      const rows = await database
        .select()
        .from(connectedAccount)
        .where(
          and(
            eq(connectedAccount.workspaceId, normalized),
            eq(connectedAccount.provider, normalizedProvider),
          ),
        )
        .orderBy(asc(connectedAccount.createdAt), asc(connectedAccount.id));
      return rows as ConnectedAccount[];
    },

    async listExpiring(before: Date, limit: number) {
      if (!(before instanceof Date) || Number.isNaN(before.getTime())) {
        throw new Error("A valid expiry cutoff is required.");
      }
      const bounded = normalizeLimit(limit);
      const rows = await database
        .select()
        .from(connectedAccount)
        .where(
          and(
            isNotNull(connectedAccount.accessTokenExpiresAt),
            isNotNull(connectedAccount.tokenCiphertext),
            lt(connectedAccount.accessTokenExpiresAt, before),
            eq(connectedAccount.status, "active"),
          ),
        )
        .orderBy(asc(connectedAccount.accessTokenExpiresAt), asc(connectedAccount.id))
        .limit(bounded);
      return rows as ConnectedAccount[];
    },

    async put(input: PutConnectedAccountInput) {
      const identity = normalizeIdentity(input);
      const envelope = normalizeEnvelope(input.tokens);
      const status = normalizeStatus(input.status);
      const reason = normalizeOptionalLength(input.failureReason, 500, "failure reason");
      const label = normalizeOptionalLength(input.label, 255, "label");
      const scopes = normalizeScopes(input.scopes);
      const accessTokenExpiresAt = normalizeOptionalDate(
        input.accessTokenExpiresAt,
        "access token expiry",
      );
      const lastRefreshedAt = normalizeOptionalDate(
        input.lastRefreshedAt,
        "last refreshed timestamp",
      );
      const insertStatus = status ?? "active";
      // Resolved before the insert so a malformed identity fails validation
      // rather than surfacing mid-query.
      const id = input.id ?? accountRowId(identity);

      const [record] = await database
        .insert(connectedAccount)
        .values({
          accessTokenExpiresAt: accessTokenExpiresAt ?? null,
          externalAccountId: identity.externalAccountId,
          failureReason: insertStatus === "active" ? null : reason,
          id,
          label,
          lastRefreshedAt: lastRefreshedAt ?? null,
          provider: identity.provider,
          scopes,
          status: insertStatus,
          tokenAlgorithm: envelope?.algorithm ?? null,
          tokenAuthTag: envelope?.authTag ?? null,
          tokenCiphertext: envelope?.ciphertext ?? null,
          tokenIv: envelope?.iv ?? null,
          tokenVersion: envelope?.version ?? null,
          workspaceId: identity.workspaceId,
        })
        .onConflictDoUpdate({
          target: [
            connectedAccount.workspaceId,
            connectedAccount.provider,
            connectedAccount.externalAccountId,
          ],
          set: {
            ...(accessTokenExpiresAt !== undefined ? { accessTokenExpiresAt } : {}),
            ...(status !== undefined || input.failureReason !== undefined
              ? { failureReason: status === "active" ? null : reason }
              : {}),
            ...(input.label !== undefined ? { label } : {}),
            ...(lastRefreshedAt !== undefined ? { lastRefreshedAt } : {}),
            ...(input.scopes !== undefined ? { scopes } : {}),
            ...(status !== undefined ? { status } : {}),
            ...(input.tokens !== undefined
              ? envelope === null
                ? {
                    tokenAlgorithm: null,
                    tokenAuthTag: null,
                    tokenCiphertext: null,
                    tokenIv: null,
                    tokenVersion: null,
                  }
                : {
                    tokenAlgorithm: envelope.algorithm,
                    tokenAuthTag: envelope.authTag,
                    tokenCiphertext: envelope.ciphertext,
                    tokenIv: envelope.iv,
                    tokenVersion: envelope.version,
                  }
              : {}),
            updatedAt: new Date(),
          },
        })
        .returning();

      if (record === undefined) {
        throw new Error("Connected account upsert returned no row.");
      }
      return record as ConnectedAccount;
    },

    async updateStatus(
      workspaceId: string,
      id: string,
      status: ConnectedAccountStatus,
      failureReason?: string | null,
    ) {
      const scoped = normalizeRowScope(workspaceId, id);
      const normalizedStatus = requireStatus(status);
      const reason = normalizeOptionalLength(failureReason, 500, "failure reason");

      await database
        .update(connectedAccount)
        .set({
          failureReason: normalizedStatus === "active" ? null : (reason ?? null),
          status: normalizedStatus,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(connectedAccount.workspaceId, scoped.workspaceId),
            eq(connectedAccount.id, scoped.id),
          ),
        );
    },

    async updateTokens(workspaceId: string, id: string, input: UpdateConnectedAccountTokensInput) {
      const scoped = normalizeRowScope(workspaceId, id);
      const envelope = requireEnvelope(input.tokens);
      const accessTokenExpiresAt = normalizeOptionalDate(
        input.accessTokenExpiresAt,
        "access token expiry",
      );
      const lastRefreshedAt = normalizeOptionalDate(
        input.lastRefreshedAt,
        "last refreshed timestamp",
      );

      // The status predicate is part of the write, not a pre-check: a row
      // flagged needs_reauth/revoked between the sweep's listExpiring and
      // this update must not be flipped back to "active" by a stale write.
      const updated = await database
        .update(connectedAccount)
        .set({
          ...(accessTokenExpiresAt !== undefined ? { accessTokenExpiresAt } : {}),
          failureReason: null,
          lastRefreshedAt: lastRefreshedAt ?? new Date(),
          status: "active",
          tokenAlgorithm: envelope.algorithm,
          tokenAuthTag: envelope.authTag,
          tokenCiphertext: envelope.ciphertext,
          tokenIv: envelope.iv,
          tokenVersion: envelope.version,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(connectedAccount.workspaceId, scoped.workspaceId),
            eq(connectedAccount.id, scoped.id),
            eq(connectedAccount.status, "active"),
          ),
        )
        .returning({ id: connectedAccount.id });
      return updated.length > 0;
    },
  });
}

type ConnectedAccountIdentity = {
  readonly externalAccountId: string;
  readonly provider: string;
  readonly workspaceId: string;
};

/**
 * The deterministic row id `put` generates for an identity when no explicit
 * `id` is supplied. Token envelopes are AAD-bound to this id, so callers
 * encrypting before the upsert must derive it here rather than reimplement
 * the formula. Identities containing ":" are rejected (same as `put`).
 */
export function connectedAccountRowId(identity: ConnectedAccountIdentity): string {
  return accountRowId(normalizeIdentity(identity));
}

function accountRowId(identity: ConnectedAccountIdentity): string {
  // Components join with ":" — a ":" inside any component would let distinct
  // identities collapse onto the same generated row id. Callers needing ":"
  // in an external id must pass an explicit `id` instead.
  if (
    identity.workspaceId.includes(":") ||
    identity.provider.includes(":") ||
    identity.externalAccountId.includes(":")
  ) {
    throw new Error("A valid connected account identity is required.");
  }
  return `connected_account:${identity.workspaceId}:${identity.provider}:${identity.externalAccountId}`;
}

function normalizeWorkspaceId(workspaceId: string): string {
  if (typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
    throw new Error("A valid workspace is required.");
  }
  return workspaceId;
}

function normalizeProvider(provider: string): string {
  if (typeof provider !== "string" || provider.trim().length === 0 || provider.length > 32) {
    throw new Error("A valid provider is required.");
  }
  return provider;
}

function normalizeRowScope(workspaceId: string, id: string): { id: string; workspaceId: string } {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error("A valid account id is required.");
  }
  return { id, workspaceId: normalizedWorkspaceId };
}

function normalizeIdentity(input: {
  externalAccountId: string;
  provider: string;
  workspaceId: string;
}): ConnectedAccountIdentity {
  const normalizedWorkspaceId = normalizeWorkspaceId(input.workspaceId);
  const normalizedProvider = normalizeProvider(input.provider);
  if (
    typeof input.externalAccountId !== "string" ||
    input.externalAccountId.trim().length === 0 ||
    input.externalAccountId.length > 255
  ) {
    throw new Error("A valid external account id is required.");
  }
  return Object.freeze({
    externalAccountId: input.externalAccountId,
    provider: normalizedProvider,
    workspaceId: normalizedWorkspaceId,
  });
}

function normalizeStatus(
  status: ConnectedAccountStatus | undefined,
): ConnectedAccountStatus | undefined {
  if (status === undefined) {
    return undefined;
  }
  return requireStatus(status);
}

function requireStatus(status: ConnectedAccountStatus): ConnectedAccountStatus {
  if (!CONNECTED_ACCOUNT_STATUSES.includes(status)) {
    throw new Error("A valid connected account status is required.");
  }
  return status;
}

function normalizeOptionalLength(
  value: string | null | undefined,
  maxLength: number,
  field: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error(`A valid ${field} is required.`);
  }
  return value;
}

function normalizeScopes(scopes: readonly string[] | null | undefined): string[] | null {
  if (scopes === undefined || scopes === null) {
    return null;
  }
  return [...scopes];
}

function normalizeLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("A valid row limit is required.");
  }
  return limit;
}

function normalizeOptionalDate(
  value: Date | null | undefined,
  field: string,
): Date | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`A valid ${field} is required.`);
  }
  return value;
}

/**
 * `undefined` and `null` are distinct: callers branch on `input.tokens !==
 * undefined` to decide whether the conflict set touches token columns at all
 * (null then writes NULLs, an envelope writes its fields).
 */
function normalizeEnvelope(
  envelope: ConnectedAccountTokenEnvelope | null | undefined,
): ConnectedAccountTokenEnvelope | null {
  if (envelope === undefined || envelope === null) {
    return null;
  }
  return requireEnvelope(envelope);
}

function requireEnvelope(envelope: ConnectedAccountTokenEnvelope): ConnectedAccountTokenEnvelope {
  if (
    typeof envelope !== "object" ||
    envelope === null ||
    envelope.algorithm !== AES_256_GCM ||
    envelope.version !== ENVELOPE_VERSION ||
    typeof envelope.iv !== "string" ||
    envelope.iv.length === 0 ||
    typeof envelope.authTag !== "string" ||
    envelope.authTag.length === 0 ||
    typeof envelope.ciphertext !== "string" ||
    envelope.ciphertext.length === 0
  ) {
    throw new Error("A valid encrypted token envelope is required.");
  }
  return envelope;
}
