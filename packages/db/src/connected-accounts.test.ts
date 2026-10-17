import { randomBytes } from "node:crypto";

import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { connectedAccount } from "./schema.js";
import {
  ConnectedAccountVaultError,
  createConnectedAccountVault,
} from "./connected-account-vault.js";
import { createDrizzleConnectedAccountRepository } from "./connected-accounts.js";

const MASTER_KEY = randomBytes(32).toString("base64");
const SCOPE = Object.freeze({
  accountId: "acct_123",
  provider: "google",
  workspaceId: "ws_123",
});

describe("connected_account schema", () => {
  it("defines the workspace-scoped connected account table", () => {
    expect(getTableName(connectedAccount)).toBe("connected_account");

    const columns = getTableColumns(connectedAccount);
    expect(columns.id.notNull).toBe(true);
    expect(columns.workspaceId.notNull).toBe(true);
    expect(columns.provider.notNull).toBe(true);
    expect(columns.provider.getSQLType()).toBe("varchar(32)");
    expect(columns.externalAccountId.notNull).toBe(true);
    expect(columns.externalAccountId.getSQLType()).toBe("varchar(255)");
    expect(columns.label?.getSQLType()).toBe("varchar(255)");
    expect(columns.scopes?.getSQLType()).toBe("text[]");
    expect(columns.scopes?.notNull).toBe(false);
    expect(columns.accessTokenExpiresAt?.notNull).toBe(false);
    expect(columns.status.notNull).toBe(true);
    expect(columns.status.default).toBe("active");
    expect(columns.lastRefreshedAt?.notNull).toBe(false);
    expect(columns.failureReason?.getSQLType()).toBe("varchar(500)");
    expect(columns.failureReason?.notNull).toBe(false);
    expect(columns.createdAt.notNull).toBe(true);
    expect(columns.updatedAt.notNull).toBe(true);
  });

  it("stores token material only as a nullable encrypted envelope", () => {
    const columns = getTableColumns(connectedAccount);

    expect(columns.tokenAlgorithm?.notNull).toBe(false);
    expect(columns.tokenVersion?.getSQLType()).toBe("integer");
    expect(columns.tokenVersion?.notNull).toBe(false);
    expect(columns.tokenIv?.notNull).toBe(false);
    expect(columns.tokenAuthTag?.notNull).toBe(false);
    expect(columns.tokenCiphertext?.notNull).toBe(false);

    // Plaintext secrets must never be columns.
    expect(columns).not.toHaveProperty("accessToken");
    expect(columns).not.toHaveProperty("refreshToken");
    expect(columns).not.toHaveProperty("smtpPassword");
  });

  it("enforces the (workspace, provider, external account) identity plus lookup indexes", () => {
    const indexes = getTableConfig(connectedAccount).indexes;
    const columnNames = (index: (typeof indexes)[number]) =>
      index.config.columns.map((column) =>
        typeof column === "object" && "name" in column ? column.name : String(column),
      );

    const unique = indexes.filter((index) => index.config.unique).map(columnNames);
    expect(unique).toContainEqual(["workspace_id", "provider", "external_account_id"]);

    const lookup = indexes.filter((index) => !index.config.unique).map(columnNames);
    expect(lookup).toContainEqual(["workspace_id"]);
    expect(lookup).toContainEqual(["workspace_id", "status"]);
    // The global refresh sweep filters/sorts on access_token_expires_at.
    expect(lookup).toContainEqual(["access_token_expires_at"]);
  });
});

describe("connected account token vault", () => {
  it("round-trips access, refresh, and smtp secrets through an AES-256-GCM envelope", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const tokens = {
      accessToken: "ya29.access-token",
      refreshToken: "refresh-token-1",
      smtpPassword: "smtp secret",
    };

    const envelope = vault.encrypt(SCOPE, tokens);

    expect(envelope.algorithm).toBe("aes-256-gcm");
    expect(envelope.version).toBe(1);
    expect(Buffer.from(envelope.iv, "base64")).toHaveLength(12);
    expect(Buffer.from(envelope.authTag, "base64")).toHaveLength(16);
    expect(envelope.ciphertext).not.toContain("ya29");
    expect(envelope.ciphertext).not.toContain("smtp secret");

    expect(vault.decrypt(SCOPE, envelope)).toEqual(tokens);
  });

  it("round-trips access-token-only envelopes (refresh/smtp optional)", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const envelope = vault.encrypt(SCOPE, { accessToken: "x-oauth-token" });

    expect(vault.decrypt(SCOPE, envelope)).toEqual({ accessToken: "x-oauth-token" });
  });

  it("round-trips the SMTP transport config alongside the password", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const tokens = {
      smtpHost: "smtp.example.com",
      smtpPassword: "smtp secret",
      smtpPort: 587,
      smtpSecure: true,
      smtpUser: "ada@example.com",
    };

    const envelope = vault.encrypt(SCOPE, tokens);

    expect(envelope.ciphertext).not.toContain("smtp.example.com");
    expect(envelope.ciphertext).not.toContain("ada@example.com");
    expect(vault.decrypt(SCOPE, envelope)).toEqual(tokens);
  });

  it("round-trips a ':'-containing SMTP user — transport config lives in the envelope, not the identity", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const tokens = {
      smtpHost: "smtp.example.com",
      smtpPassword: "secret",
      smtpUser: "DOMAIN:ada",
    };

    expect(vault.decrypt(SCOPE, vault.encrypt(SCOPE, tokens))).toEqual(tokens);
  });

  it("still parses envelopes written before the SMTP transport fields existed", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    // A pre-change envelope is exactly {smtpPassword} — the new fields are
    // optional and stay absent when the payload omits them.
    const envelope = vault.encrypt(SCOPE, { smtpPassword: "legacy secret" });

    const decrypted = vault.decrypt(SCOPE, envelope);
    expect(decrypted).toEqual({ smtpPassword: "legacy secret" });
    expect(decrypted.smtpHost).toBeUndefined();
    expect(decrypted.smtpUser).toBeUndefined();
    expect(decrypted.smtpPort).toBeUndefined();
    expect(decrypted.smtpSecure).toBeUndefined();
  });

  it("validates SMTP transport fields at encrypt time — malformed values never reach the envelope", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const base = { smtpPassword: "secret" };

    for (const bad of [
      { ...base, smtpPort: 0 },
      { ...base, smtpPort: 65536 },
      { ...base, smtpPort: 25.5 },
      { ...base, smtpPort: "587" as never },
      { ...base, smtpSecure: "yes" as never },
      { ...base, smtpSecure: 1 as never },
      { ...base, smtpHost: "" },
      { ...base, smtpHost: "h".repeat(256) },
      { ...base, smtpHost: 42 as never },
      { ...base, smtpUser: "" },
      { ...base, smtpUser: "u".repeat(256) },
    ]) {
      expect(() => vault.encrypt(SCOPE, bad)).toThrow(ConnectedAccountVaultError);
    }

    // Boundary values are accepted.
    expect(() =>
      vault.encrypt(SCOPE, { ...base, smtpHost: "h", smtpPort: 1, smtpSecure: false }),
    ).not.toThrow();
    expect(() => vault.encrypt(SCOPE, { ...base, smtpPort: 65535 })).not.toThrow();
  });

  it("round-trips optional IMAP host/auth in the encrypted credential payload", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const tokens = {
      imapHost: "imap.example.com",
      imapPassword: "imap secret",
      imapUser: "ada@example.com",
      smtpHost: "smtp.example.com",
      smtpPassword: "smtp secret",
      smtpUser: "ada@example.com",
    };
    const envelope = vault.encrypt(SCOPE, tokens);
    expect(envelope.ciphertext).not.toContain("imap.example.com");
    expect(envelope.ciphertext).not.toContain("imap secret");
    expect(vault.decrypt(SCOPE, envelope)).toEqual(tokens);
  });

  it("accepts an explicit IMAP host with deliberate SMTP auth fallback and rejects invalid IMAP config", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    expect(() =>
      vault.encrypt(SCOPE, { imapHost: "imap.example.com", smtpPassword: "p" }),
    ).not.toThrow();

    for (const bad of [
      { imapHost: "", smtpPassword: "p" },
      { imapHost: "h".repeat(256), smtpPassword: "p" },
      { imapHost: 42 as never, smtpPassword: "p" },
      { imapUser: "ada", smtpPassword: "p" },
      { imapPassword: "secret", smtpPassword: "p" },
      { imapHost: "imap.example.com", imapUser: "", smtpPassword: "p" },
      { imapHost: "imap.example.com", imapUser: "u".repeat(256), smtpPassword: "p" },
      { imapHost: "imap.example.com", imapPassword: "", smtpPassword: "p" },
      { imapHost: "imap.example.com", imapPassword: "p".repeat(256), smtpPassword: "p" },
      { imapHost: "imap.example.com", imapPassword: 42 as never, smtpPassword: "p" },
    ]) {
      expect(() => vault.encrypt(SCOPE, bad)).toThrow(ConnectedAccountVaultError);
    }
  });

  it("drops unknown payload keys — decrypt returns a whitelist, not the parsed object", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const envelope = vault.encrypt(SCOPE, {
      accessToken: "x",
      smtpHost: "smtp.example.com",
      smuggled: "payload",
    } as never);

    const decrypted = vault.decrypt(SCOPE, envelope) as Record<string, unknown>;
    expect(decrypted).toEqual({ accessToken: "x", smtpHost: "smtp.example.com" });
    expect("smuggled" in decrypted).toBe(false);
  });

  it("randomizes the IV so identical tokens encrypt differently", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const tokens = { accessToken: "same-token" };

    const first = vault.encrypt(SCOPE, tokens);
    const second = vault.encrypt(SCOPE, tokens);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("supports deterministic IV injection for tests", () => {
    const fixedCrypto = { randomBytes: () => new Uint8Array(12).fill(7) };
    const vault = createConnectedAccountVault(MASTER_KEY, fixedCrypto);

    const first = vault.encrypt(SCOPE, { accessToken: "fixed" });
    const second = vault.encrypt(SCOPE, { accessToken: "fixed" });

    expect(first).toEqual(second);
  });

  it("rejects tampered ciphertext without leaking plaintext", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const envelope = vault.encrypt(SCOPE, { accessToken: "ya29.access-token" });
    const raw = Buffer.from(envelope.ciphertext, "base64");
    raw[0] = raw[0]! ^ 0xff;
    const tampered = { ...envelope, ciphertext: raw.toString("base64") };

    try {
      vault.decrypt(SCOPE, tampered);
      expect.unreachable("decrypt must reject tampered ciphertext");
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectedAccountVaultError);
      expect((error as Error).message).not.toContain("ya29");
      expect((error as Error).message).not.toContain("access-token");
    }
  });

  it("rejects decryption under a different AAD scope", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const envelope = vault.encrypt(SCOPE, { accessToken: "scoped-token" });

    for (const wrong of [
      { ...SCOPE, accountId: "acct_other" },
      { ...SCOPE, provider: "microsoft" },
      { ...SCOPE, workspaceId: "ws_other" },
    ]) {
      expect(() => vault.decrypt(wrong, envelope)).toThrow(ConnectedAccountVaultError);
    }
  });

  it("rejects decryption with the wrong master key", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const envelope = vault.encrypt(SCOPE, { accessToken: "key-bound" });
    const other = createConnectedAccountVault(randomBytes(32).toString("base64"));

    expect(() => other.decrypt(SCOPE, envelope)).toThrow(ConnectedAccountVaultError);
  });

  it("rejects malformed envelope fields at decrypt time", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const envelope = vault.encrypt(SCOPE, { accessToken: "secret" });

    for (const malformed of [
      { ...envelope, iv: "!!!not-base64!!!" },
      // Valid base64 but not a 12-byte GCM IV.
      { ...envelope, iv: Buffer.alloc(8).toString("base64") },
      { ...envelope, authTag: "%%%" },
      { ...envelope, ciphertext: "not base64 =" },
    ]) {
      expect(() => vault.decrypt(SCOPE, malformed)).toThrow(ConnectedAccountVaultError);
    }
  });

  it("returns a frozen token set from decrypt", () => {
    const vault = createConnectedAccountVault(MASTER_KEY);
    const envelope = vault.encrypt(SCOPE, { accessToken: "secret" });

    expect(Object.isFrozen(vault.decrypt(SCOPE, envelope))).toBe(true);
  });

  it("rejects malformed master keys and empty token sets", () => {
    expect(() => createConnectedAccountVault("not base64 !!!")).toThrow(ConnectedAccountVaultError);
    expect(() => createConnectedAccountVault(randomBytes(16).toString("base64"))).toThrow(
      ConnectedAccountVaultError,
    );

    const vault = createConnectedAccountVault(MASTER_KEY);
    expect(() => vault.encrypt(SCOPE, { accessToken: "" })).toThrow(ConnectedAccountVaultError);
    expect(() => vault.encrypt({ ...SCOPE, provider: "" }, { accessToken: "x" })).toThrow(
      ConnectedAccountVaultError,
    );
  });
});

const VALID_ENVELOPE = {
  algorithm: "aes-256-gcm" as const,
  authTag: "dGFn",
  ciphertext: "Y2lwaGVy",
  iv: "aXYtMTIz",
  version: 1 as const,
};

const BASE_PUT = {
  externalAccountId: "acct",
  provider: "google",
  workspaceId: "ws_1",
} as const;

/**
 * Captures the `values`/`set` payloads the repository builds without needing a
 * database — the insert/update chain resolves to a canned row.
 */
function createCapturingDatabase() {
  const calls: {
    limit?: number;
    set?: Record<string, unknown>;
    updateSet?: Record<string, unknown>;
    /** Rows the next update `.returning()` yields — stub to simulate hits/misses. */
    updateReturning?: { id: string }[];
    values?: Record<string, unknown>;
  } = {};
  const database = {
    insert() {
      return {
        values(values: Record<string, unknown>) {
          calls.values = values;
          return {
            onConflictDoUpdate(conflict: { set: Record<string, unknown> }) {
              calls.set = conflict.set;
              return {
                async returning() {
                  return [{ id: "acct_1" }];
                },
              };
            },
          };
        },
      };
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                orderBy() {
                  return {
                    async limit(limit: number) {
                      calls.limit = limit;
                      return [];
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          calls.updateSet = values;
          return {
            where() {
              // Awaiting the where clause (updateStatus) resolves to []; the
              // chained `.returning()` (updateTokens) yields the stubbed rows.
              return Object.assign(Promise.resolve([]), {
                async returning() {
                  return calls.updateReturning ?? [{ id: "acct_1" }];
                },
              });
            },
          };
        },
      };
    },
  };
  return { calls, database: database as never };
}

describe("drizzle connected account repository contract", () => {
  it("exports the repository factory", () => {
    expect(createDrizzleConnectedAccountRepository).toEqual(expect.any(Function));
  });

  it("validates workspace scope before touching the database", async () => {
    const repository = createDrizzleConnectedAccountRepository(null as never);

    await expect(repository.list("")).rejects.toThrow();
    await expect(repository.list("   ")).rejects.toThrow();
    await expect(repository.get("ws_1", "")).rejects.toThrow();
    await expect(repository.getByExternalId("ws_1", "google", "")).rejects.toThrow();
    await expect(
      repository.put({ externalAccountId: "acct", provider: "google", workspaceId: " " }),
    ).rejects.toThrow();
    await expect(
      repository.put({ externalAccountId: "", provider: "google", workspaceId: "ws_1" }),
    ).rejects.toThrow();
    await expect(repository.delete("ws_1", "")).rejects.toThrow();
  });

  it("rejects invalid statuses and malformed token envelopes before writing", async () => {
    const repository = createDrizzleConnectedAccountRepository(null as never);
    const envelope = {
      algorithm: "aes-256-gcm" as const,
      authTag: "dGFn",
      ciphertext: "Y2lwaGVy",
      iv: "aXYtMTIz",
      version: 1 as const,
    };

    await expect(repository.updateStatus("ws_1", "acct_1", "suspended" as never)).rejects.toThrow();
    await expect(
      repository.updateTokens("ws_1", "acct_1", {
        tokens: { ...envelope, ciphertext: "" },
      }),
    ).rejects.toThrow();
    await expect(
      repository.updateTokens("ws_1", "acct_1", {
        tokens: { ...envelope, algorithm: "aes-128-gcm" as never },
      }),
    ).rejects.toThrow();
    await expect(
      repository.put({
        externalAccountId: "acct",
        provider: "google",
        tokens: { ...envelope, version: 2 as never },
        workspaceId: "ws_1",
      }),
    ).rejects.toThrow();
  });

  it("put writes only provided fields on conflict — undefined leaves the stored value", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzleConnectedAccountRepository(database);

    await repository.put(BASE_PUT);
    expect(calls.set).toEqual({ updatedAt: expect.any(Date) });
    // Omitted fields keep the stored value on update…
    expect(calls.set).not.toHaveProperty("label");
    expect(calls.set).not.toHaveProperty("scopes");
    expect(calls.set).not.toHaveProperty("accessTokenExpiresAt");
    // …while a fresh insert still defaults every column.
    expect(calls.values).toMatchObject({ label: null, scopes: null, status: "active" });

    await repository.put({
      ...BASE_PUT,
      accessTokenExpiresAt: null,
      label: null,
      lastRefreshedAt: null,
      scopes: null,
    });
    expect(calls.set).toMatchObject({
      accessTokenExpiresAt: null,
      label: null,
      lastRefreshedAt: null,
      scopes: null,
    });
  });

  it("put mirrors the updateStatus invariant for status + failureReason", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzleConnectedAccountRepository(database);

    // A reason can finally ride through put on non-active statuses.
    await repository.put({ ...BASE_PUT, status: "needs_reauth", failureReason: "refresh failed" });
    expect(calls.set).toMatchObject({
      failureReason: "refresh failed",
      status: "needs_reauth",
    });
    expect(calls.values).toMatchObject({
      failureReason: "refresh failed",
      status: "needs_reauth",
    });

    // No reason provided on a non-active status clears any stale reason.
    await repository.put({ ...BASE_PUT, status: "needs_reauth" });
    expect(calls.set).toMatchObject({ failureReason: null, status: "needs_reauth" });

    // status: "active" clears the reason — even when one was supplied.
    await repository.put({ ...BASE_PUT, status: "active", failureReason: "stale" });
    expect(calls.set).toMatchObject({ failureReason: null, status: "active" });

    // A reason without a status writes just the reason.
    await repository.put({ ...BASE_PUT, failureReason: "orphan" });
    expect(calls.set).toMatchObject({ failureReason: "orphan" });
    expect(calls.set).not.toHaveProperty("status");
    // …but on insert the row defaults to active, so the reason is dropped.
    expect(calls.values).toMatchObject({ failureReason: null, status: "active" });

    await repository.put({ ...BASE_PUT });
    expect(calls.set).not.toHaveProperty("failureReason");

    await expect(repository.put({ ...BASE_PUT, failureReason: "x".repeat(501) })).rejects.toThrow();
  });

  it("put clears stored tokens on tokens: null and leaves them on undefined", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzleConnectedAccountRepository(database);

    await repository.put({ ...BASE_PUT, tokens: null });
    expect(calls.set).toMatchObject({
      tokenAlgorithm: null,
      tokenAuthTag: null,
      tokenCiphertext: null,
      tokenIv: null,
      tokenVersion: null,
    });

    await repository.put(BASE_PUT);
    for (const key of Object.keys(calls.set ?? {})) {
      expect(key).not.toMatch(/^token/);
    }

    await repository.put({ ...BASE_PUT, tokens: VALID_ENVELOPE });
    expect(calls.set).toMatchObject({
      tokenAlgorithm: "aes-256-gcm",
      tokenCiphertext: VALID_ENVELOPE.ciphertext,
      tokenIv: VALID_ENVELOPE.iv,
      tokenVersion: 1,
    });
  });

  it("rejects ':' in identity components only when generating the row id", async () => {
    const repository = createDrizzleConnectedAccountRepository(null as never);

    await expect(repository.put({ ...BASE_PUT, externalAccountId: "a:b" })).rejects.toThrow(
      "A valid connected account identity is required.",
    );
    await expect(repository.put({ ...BASE_PUT, provider: "g:x" })).rejects.toThrow(
      "A valid connected account identity is required.",
    );
    await expect(repository.put({ ...BASE_PUT, workspaceId: "ws:1" })).rejects.toThrow(
      "A valid connected account identity is required.",
    );

    // A caller-supplied id skips the ':'-joined default, so ':' stays legal.
    const { calls, database } = createCapturingDatabase();
    const customId = createDrizzleConnectedAccountRepository(database);
    await customId.put({ ...BASE_PUT, externalAccountId: "a:b", id: "custom-id" });
    expect(calls.values).toMatchObject({ id: "custom-id" });
  });

  it("validates listExpiring inputs before querying the database", async () => {
    const repository = createDrizzleConnectedAccountRepository(null as never);
    const now = new Date();

    await expect(repository.listExpiring(now, 0)).rejects.toThrow();
    await expect(repository.listExpiring(now, 501)).rejects.toThrow();
    await expect(repository.listExpiring(now, 1.5)).rejects.toThrow();
    await expect(repository.listExpiring(now, Number.NaN)).rejects.toThrow();
    await expect(repository.listExpiring(new Date("not a date"), 10)).rejects.toThrow();
    await expect(repository.listExpiring("soon" as never, 10)).rejects.toThrow();
  });

  it("accepts listExpiring boundary limits 1 and 500", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzleConnectedAccountRepository(database);

    await expect(repository.listExpiring(new Date(), 1)).resolves.toEqual([]);
    expect(calls.limit).toBe(1);
    await expect(repository.listExpiring(new Date(), 500)).resolves.toEqual([]);
    expect(calls.limit).toBe(500);
  });

  it("rejects Invalid Date on expiry and refresh timestamps", async () => {
    const repository = createDrizzleConnectedAccountRepository(null as never);

    await expect(
      repository.put({ ...BASE_PUT, accessTokenExpiresAt: new Date("nope") }),
    ).rejects.toThrow();
    await expect(
      repository.put({ ...BASE_PUT, lastRefreshedAt: new Date(Number.NaN) }),
    ).rejects.toThrow();
    await expect(
      repository.updateTokens("ws_1", "acct_1", {
        accessTokenExpiresAt: new Date("nope"),
        tokens: VALID_ENVELOPE,
      }),
    ).rejects.toThrow();
    await expect(
      repository.updateTokens("ws_1", "acct_1", {
        lastRefreshedAt: new Date("nope"),
        tokens: VALID_ENVELOPE,
      }),
    ).rejects.toThrow();

    // null still clears and valid dates pass through to the write.
    const { calls, database } = createCapturingDatabase();
    const capturing = createDrizzleConnectedAccountRepository(database);
    await capturing.updateTokens("ws_1", "acct_1", {
      accessTokenExpiresAt: null,
      tokens: VALID_ENVELOPE,
    });
    expect(calls.updateSet).toMatchObject({ accessTokenExpiresAt: null });
  });

  it("updateTokens reports whether the write landed on an active row", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzleConnectedAccountRepository(database);

    await expect(
      repository.updateTokens("ws_1", "acct_1", { tokens: VALID_ENVELOPE }),
    ).resolves.toBe(true);

    // Zero returned rows = the (workspace, id, status:"active") predicate
    // missed — a revoked/needs_reauth/deleted row is a no-op, never a
    // resurrection.
    calls.updateReturning = [];
    await expect(
      repository.updateTokens("ws_1", "acct_1", { tokens: VALID_ENVELOPE }),
    ).resolves.toBe(false);
  });
});
