import { randomBytes, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { beforeAll, describe, expect, it } from "vitest";

import { connectedAccount, workspace } from "./schema.js";
import type { PostgresDatabaseLifecycle } from "./postgres.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

async function createWorkspace(
  lifecycle: PostgresDatabaseLifecycle,
  suffix: string,
): Promise<string> {
  const id = `ws_test_${suffix}`;
  await lifecycle.database.insert(workspace).values({
    id,
    name: "Connected Accounts Test",
    slug: `connected-accounts-${suffix}`,
  });
  return id;
}

integrationDescribe("connected account repository", () => {
  beforeAll(async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });

    try {
      await migrate(lifecycle.database, { migrationsFolder });
    } finally {
      await lifecycle.close();
    }
  });

  it("upserts on (workspace, provider, external account) and scopes every read", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleConnectedAccountRepository } = await import(
      "./" + "connected-accounts.js"
    );
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    let workspaceId = "";

    try {
      workspaceId = await createWorkspace(lifecycle, suffix);
      const repository = createDrizzleConnectedAccountRepository(lifecycle.database);

      const created = await repository.put({
        externalAccountId: "acct-1",
        label: "first@gmail.com",
        provider: "google",
        scopes: ["mail", "calendar"],
        workspaceId,
      });
      expect(created.workspaceId).toBe(workspaceId);
      expect(created.status).toBe("active");

      const updated = await repository.put({
        externalAccountId: "acct-1",
        label: "renamed@gmail.com",
        provider: "google",
        workspaceId,
      });
      expect(updated.id).toBe(created.id);
      expect(updated.label).toBe("renamed@gmail.com");

      const rows = await lifecycle.database
        .select({ id: connectedAccount.id })
        .from(connectedAccount)
        .where(eq(connectedAccount.workspaceId, workspaceId));
      expect(rows).toHaveLength(1);

      await expect(repository.get(workspaceId, created.id)).resolves.toMatchObject({
        externalAccountId: "acct-1",
        label: "renamed@gmail.com",
      });
      await expect(repository.get("ws_other", created.id)).resolves.toBeNull();
      await expect(
        repository.getByExternalId(workspaceId, "google", "acct-1"),
      ).resolves.toMatchObject({ id: created.id });
      await expect(
        repository.getByExternalId(workspaceId, "microsoft", "acct-1"),
      ).resolves.toBeNull();

      expect(await repository.list(workspaceId)).toHaveLength(1);
      expect(await repository.listByProvider(workspaceId, "google")).toHaveLength(1);
      expect(await repository.listByProvider(workspaceId, "x")).toHaveLength(0);
    } finally {
      if (workspaceId !== "") {
        await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      }
      await lifecycle.close();
    }
  });

  it("stores token envelopes and refresh metadata via updateTokens", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleConnectedAccountRepository } = await import(
      "./" + "connected-accounts.js"
    );
    const { createConnectedAccountVault } = await import("./" + "connected-account-vault.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    let workspaceId = "";

    try {
      workspaceId = await createWorkspace(lifecycle, suffix);
      const repository = createDrizzleConnectedAccountRepository(lifecycle.database);
      const vault = createConnectedAccountVault(randomBytes(32).toString("base64"));

      const created = await repository.put({
        externalAccountId: "acct-tokens",
        provider: "x",
        workspaceId,
      });
      expect(created.tokenCiphertext).toBeNull();

      const envelope = vault.encrypt(
        { accountId: created.id, provider: "x", workspaceId },
        { accessToken: "x-access", refreshToken: "x-refresh" },
      );
      const expires = new Date("2030-01-01T00:00:00.000Z");
      const wrote = await repository.updateTokens(workspaceId, created.id, {
        accessTokenExpiresAt: expires,
        tokens: envelope,
      });
      expect(wrote).toBe(true);

      const stored = await repository.get(workspaceId, created.id);
      expect(stored).toMatchObject({
        status: "active",
        tokenAlgorithm: "aes-256-gcm",
        tokenAuthTag: envelope.authTag,
        tokenCiphertext: envelope.ciphertext,
        tokenIv: envelope.iv,
        tokenVersion: 1,
      });
      expect(stored?.accessTokenExpiresAt).toEqual(expires);
      expect(stored?.lastRefreshedAt).toBeInstanceOf(Date);

      const decrypted = vault.decrypt(
        { accountId: created.id, provider: "x", workspaceId },
        {
          algorithm: stored!.tokenAlgorithm as "aes-256-gcm",
          authTag: stored!.tokenAuthTag!,
          ciphertext: stored!.tokenCiphertext!,
          iv: stored!.tokenIv!,
          version: stored!.tokenVersion as 1,
        },
      );
      expect(decrypted).toEqual({ accessToken: "x-access", refreshToken: "x-refresh" });

      // The same write on a non-active row is a no-op and reports false —
      // refresh must never resurrect a revoked/needs_reauth account.
      await repository.updateStatus(workspaceId, created.id, "needs_reauth", "stale");
      const flaggedWrite = await repository.updateTokens(workspaceId, created.id, {
        tokens: vault.encrypt(
          { accountId: created.id, provider: "x", workspaceId },
          { accessToken: "replacement" },
        ),
      });
      expect(flaggedWrite).toBe(false);
      const flagged = await repository.get(workspaceId, created.id);
      expect(flagged?.status).toBe("needs_reauth");
      expect(flagged?.tokenCiphertext).toBe(envelope.ciphertext);

      await repository.updateStatus(workspaceId, created.id, "revoked");
      const revokedWrite = await repository.updateTokens(workspaceId, created.id, {
        tokens: vault.encrypt(
          { accountId: created.id, provider: "x", workspaceId },
          { accessToken: "replacement" },
        ),
      });
      expect(revokedWrite).toBe(false);
      expect((await repository.get(workspaceId, created.id))?.status).toBe("revoked");
    } finally {
      if (workspaceId !== "") {
        await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      }
      await lifecycle.close();
    }
  });

  it("tracks status transitions and failure reasons, then hard-deletes", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleConnectedAccountRepository } = await import(
      "./" + "connected-accounts.js"
    );
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    let workspaceId = "";

    try {
      workspaceId = await createWorkspace(lifecycle, suffix);
      const repository = createDrizzleConnectedAccountRepository(lifecycle.database);

      const created = await repository.put({
        externalAccountId: "acct-status",
        provider: "smtp",
        workspaceId,
      });

      await repository.updateStatus(workspaceId, created.id, "needs_reauth", "token expired");
      let stored = await repository.get(workspaceId, created.id);
      expect(stored?.status).toBe("needs_reauth");
      expect(stored?.failureReason).toBe("token expired");

      await repository.updateStatus(workspaceId, created.id, "active");
      stored = await repository.get(workspaceId, created.id);
      expect(stored?.status).toBe("active");
      expect(stored?.failureReason).toBeNull();

      await repository.delete(workspaceId, created.id);
      expect(await repository.get(workspaceId, created.id)).toBeNull();
    } finally {
      if (workspaceId !== "") {
        await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      }
      await lifecycle.close();
    }
  });

  it("lists expiring accounts oldest-first, skipping revoked, tokenless, and non-expiring rows", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleConnectedAccountRepository } = await import(
      "./" + "connected-accounts.js"
    );
    const { createConnectedAccountVault } = await import("./" + "connected-account-vault.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    let workspaceId = "";

    try {
      workspaceId = await createWorkspace(lifecycle, suffix);
      const repository = createDrizzleConnectedAccountRepository(lifecycle.database);
      const vault = createConnectedAccountVault(randomBytes(32).toString("base64"));
      // Explicit ids let the envelope AAD scope match the stored row id.
      const envelopeFor = (accountId: string) =>
        vault.encrypt({ accountId, provider: "google", workspaceId }, { accessToken: "t" });
      const soon = new Date(Date.now() + 60_000);
      const sooner = new Date(Date.now() + 30_000);
      const later = new Date(Date.now() + 3_600_000);

      const a = await repository.put({
        accessTokenExpiresAt: soon,
        externalAccountId: "expiring-a",
        id: `acct_${suffix}_a`,
        provider: "google",
        tokens: envelopeFor(`acct_${suffix}_a`),
        workspaceId,
      });
      const b = await repository.put({
        accessTokenExpiresAt: sooner,
        externalAccountId: "expiring-b",
        id: `acct_${suffix}_b`,
        provider: "google",
        tokens: envelopeFor(`acct_${suffix}_b`),
        workspaceId,
      });
      await repository.put({
        accessTokenExpiresAt: later,
        externalAccountId: "expiring-later",
        id: `acct_${suffix}_later`,
        provider: "google",
        tokens: envelopeFor(`acct_${suffix}_later`),
        workspaceId,
      });
      await repository.put({
        externalAccountId: "no-expiry",
        provider: "smtp",
        workspaceId,
      });
      // Expiring but tokenless — a pending row must never be swept.
      await repository.put({
        accessTokenExpiresAt: sooner,
        externalAccountId: "expiring-tokenless",
        provider: "google",
        workspaceId,
      });
      const revoked = await repository.put({
        accessTokenExpiresAt: sooner,
        externalAccountId: "expiring-revoked",
        id: `acct_${suffix}_revoked`,
        provider: "google",
        tokens: envelopeFor(`acct_${suffix}_revoked`),
        workspaceId,
      });
      await repository.updateStatus(workspaceId, revoked.id, "revoked");
      // needs_reauth rows are just as dead to the sweep — only "active"
      // rows re-enter, otherwise a flagged account would re-notify and
      // re-fail on every tick.
      const flagged = await repository.put({
        accessTokenExpiresAt: sooner,
        externalAccountId: "expiring-flagged",
        id: `acct_${suffix}_flagged`,
        provider: "google",
        tokens: envelopeFor(`acct_${suffix}_flagged`),
        workspaceId,
      });
      await repository.updateStatus(workspaceId, flagged.id, "needs_reauth", "grant rejected");

      const cutoff = new Date(Date.now() + 120_000);
      const expiring = await repository.listExpiring(cutoff, 10);
      const ours = expiring.filter((row) => row.workspaceId === workspaceId);

      expect(ours.map((row) => row.id)).toEqual([b.id, a.id]);
      await expect(repository.listExpiring(cutoff, 1)).resolves.toHaveLength(1);
    } finally {
      if (workspaceId !== "") {
        await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      }
      await lifecycle.close();
    }
  });

  it("carries failureReason through put and clears it on active", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleConnectedAccountRepository } = await import(
      "./" + "connected-accounts.js"
    );
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    let workspaceId = "";

    try {
      workspaceId = await createWorkspace(lifecycle, suffix);
      const repository = createDrizzleConnectedAccountRepository(lifecycle.database);

      const flagged = await repository.put({
        externalAccountId: "acct-put-status",
        failureReason: "refresh expired",
        provider: "google",
        status: "needs_reauth",
        workspaceId,
      });
      expect(flagged.status).toBe("needs_reauth");
      expect(flagged.failureReason).toBe("refresh expired");

      // Re-putting active clears the stored reason — no stale text survives.
      const healed = await repository.put({
        externalAccountId: "acct-put-status",
        provider: "google",
        status: "active",
        workspaceId,
      });
      expect(healed.id).toBe(flagged.id);
      expect(healed.status).toBe("active");
      expect(healed.failureReason).toBeNull();
    } finally {
      if (workspaceId !== "") {
        await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      }
      await lifecycle.close();
    }
  });

  it("clears stored ciphertext on tokens: null and preserves it when omitted", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleConnectedAccountRepository } = await import(
      "./" + "connected-accounts.js"
    );
    const { createConnectedAccountVault } = await import("./" + "connected-account-vault.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    let workspaceId = "";

    try {
      workspaceId = await createWorkspace(lifecycle, suffix);
      const repository = createDrizzleConnectedAccountRepository(lifecycle.database);
      const vault = createConnectedAccountVault(randomBytes(32).toString("base64"));

      const created = await repository.put({
        externalAccountId: "acct-clear",
        provider: "x",
        workspaceId,
      });
      const envelope = vault.encrypt(
        { accountId: created.id, provider: "x", workspaceId },
        { accessToken: "x-access" },
      );
      await repository.updateTokens(workspaceId, created.id, { tokens: envelope });

      // Omitting tokens leaves every token_* column untouched.
      const preserved = await repository.put({
        externalAccountId: "acct-clear",
        label: "kept",
        provider: "x",
        workspaceId,
      });
      expect(preserved.tokenCiphertext).toBe(envelope.ciphertext);
      expect(preserved.tokenIv).toBe(envelope.iv);

      // tokens: null clears all five columns.
      const cleared = await repository.put({
        externalAccountId: "acct-clear",
        provider: "x",
        tokens: null,
        workspaceId,
      });
      expect(cleared.tokenAlgorithm).toBeNull();
      expect(cleared.tokenAuthTag).toBeNull();
      expect(cleared.tokenCiphertext).toBeNull();
      expect(cleared.tokenIv).toBeNull();
      expect(cleared.tokenVersion).toBeNull();
    } finally {
      if (workspaceId !== "") {
        await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      }
      await lifecycle.close();
    }
  });

  it("stores unicode labels and settles concurrent puts on one row", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleConnectedAccountRepository } = await import(
      "./" + "connected-accounts.js"
    );
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const suffix = randomUUID().replaceAll("-", "");
    let workspaceId = "";

    try {
      workspaceId = await createWorkspace(lifecycle, suffix);
      const repository = createDrizzleConnectedAccountRepository(lifecycle.database);

      const unicode = await repository.put({
        externalAccountId: "acct-unicode",
        label: "田中さん <tanaka@example.com>",
        provider: "google",
        workspaceId,
      });
      await expect(repository.get(workspaceId, unicode.id)).resolves.toMatchObject({
        label: "田中さん <tanaka@example.com>",
      });

      const [first, second] = await Promise.all([
        repository.put({
          externalAccountId: "acct-race",
          label: "one",
          provider: "google",
          workspaceId,
        }),
        repository.put({
          externalAccountId: "acct-race",
          label: "two",
          provider: "google",
          workspaceId,
        }),
      ]);
      expect(first.id).toBe(second.id);
      const rows = await lifecycle.database
        .select({ id: connectedAccount.id })
        .from(connectedAccount)
        .where(
          and(
            eq(connectedAccount.workspaceId, workspaceId),
            eq(connectedAccount.externalAccountId, "acct-race"),
          ),
        );
      expect(rows).toHaveLength(1);
    } finally {
      if (workspaceId !== "") {
        await lifecycle.database.delete(workspace).where(eq(workspace.id, workspaceId));
      }
      await lifecycle.close();
    }
  });
});
