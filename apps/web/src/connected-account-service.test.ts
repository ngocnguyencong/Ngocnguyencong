import { describe, expect, it, vi } from "vitest";

import type { ConnectedAccountProviderConfig } from "@supastack/config";
import {
  createConnectedAccountVault,
  type ConnectedAccount,
  type ConnectedAccountRepository,
  type PutConnectedAccountInput,
  type UpdateConnectedAccountTokensInput,
} from "@supastack/db";

import {
  connectedAccountTokenEnvelope,
  createConnectedAccountService,
  handleOAuthCallback,
  prepareOAuthConnect,
  smtpExternalAccountId,
  type ConnectedAccountRefreshResult,
} from "./connected-account-service.js";
import { signOAuthState, verifyOAuthState } from "./oauth-state.js";

const SECRET = "state-signing-secret-for-tests";
const MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
const NOW = new Date("2026-09-24T12:00:00.000Z");

const vault = createConnectedAccountVault(MASTER_KEY);

const enabledConfig: ConnectedAccountProviderConfig = {
  clientId: "client-123",
  clientSecret: "client-secret",
  enabled: true,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function makeRow(overrides: Partial<ConnectedAccount> = {}): ConnectedAccount {
  return {
    accessTokenExpiresAt: null,
    createdAt: NOW,
    externalAccountId: "ext-1",
    failureReason: null,
    id: "connected_account:ws_1:x:ext-1",
    label: "@acme",
    lastRefreshedAt: null,
    provider: "x",
    scopes: ["tweet.read"],
    status: "active",
    tokenAlgorithm: null,
    tokenAuthTag: null,
    tokenCiphertext: null,
    tokenIv: null,
    tokenVersion: null,
    updatedAt: NOW,
    workspaceId: "ws_1",
    ...overrides,
  } as ConnectedAccount;
}

function fakeRepo(initial: ConnectedAccount[] = []) {
  const rows = new Map<string, ConnectedAccount>(initial.map((row) => [row.id, row]));
  const calls = {
    put: [] as PutConnectedAccountInput[],
    updateStatus: [] as { id: string; reason: string | null | undefined; status: string }[],
    updateTokens: [] as { id: string; input: UpdateConnectedAccountTokensInput }[],
    listExpiring: [] as { before: Date; limit: number }[],
  };
  const repository: ConnectedAccountRepository = {
    async delete(workspaceId, id) {
      rows.delete(id);
    },
    async get(workspaceId, id) {
      const row = rows.get(id);
      return row !== undefined && row.workspaceId === workspaceId ? row : null;
    },
    async getByExternalId(workspaceId, provider, externalAccountId) {
      return (
        [...rows.values()].find(
          (row) =>
            row.workspaceId === workspaceId &&
            row.provider === provider &&
            row.externalAccountId === externalAccountId,
        ) ?? null
      );
    },
    async list(workspaceId) {
      return [...rows.values()].filter((row) => row.workspaceId === workspaceId);
    },
    async listByProvider(workspaceId, provider) {
      return [...rows.values()].filter(
        (row) => row.workspaceId === workspaceId && row.provider === provider,
      );
    },
    async listExpiring(before, limit) {
      calls.listExpiring.push({ before, limit });
      return [...rows.values()]
        .filter(
          (row) =>
            row.accessTokenExpiresAt !== null &&
            row.accessTokenExpiresAt < before &&
            row.tokenCiphertext !== null &&
            row.status === "active",
        )
        .slice(0, limit);
    },
    async put(input) {
      calls.put.push(input);
      const row = makeRow({
        accessTokenExpiresAt: input.accessTokenExpiresAt ?? null,
        externalAccountId: input.externalAccountId,
        id:
          input.id ??
          `connected_account:${input.workspaceId}:${input.provider}:${input.externalAccountId}`,
        label: input.label ?? null,
        lastRefreshedAt: input.lastRefreshedAt ?? null,
        provider: input.provider,
        scopes: input.scopes ? [...input.scopes] : null,
        status: input.status ?? "active",
        workspaceId: input.workspaceId,
        ...(input.tokens
          ? {
              tokenAlgorithm: input.tokens.algorithm,
              tokenAuthTag: input.tokens.authTag,
              tokenCiphertext: input.tokens.ciphertext,
              tokenIv: input.tokens.iv,
              tokenVersion: input.tokens.version,
            }
          : {}),
      });
      rows.set(row.id, row);
      return row;
    },
    async updateStatus(workspaceId, id, status, failureReason) {
      calls.updateStatus.push({ id, reason: failureReason, status });
      const row = rows.get(id);
      if (row) {
        rows.set(id, { ...row, failureReason: failureReason ?? null, status });
      }
    },
    async updateTokens(workspaceId, id, input) {
      calls.updateTokens.push({ id, input });
      const row = rows.get(id);
      // Mirrors the drizzle predicate: only an active row may absorb fresh
      // tokens — anything else is a no-op that reports false.
      if (row === undefined || row.workspaceId !== workspaceId || row.status !== "active") {
        return false;
      }
      rows.set(id, {
        ...row,
        accessTokenExpiresAt: input.accessTokenExpiresAt ?? row.accessTokenExpiresAt,
        status: "active",
        tokenAlgorithm: input.tokens.algorithm,
        tokenAuthTag: input.tokens.authTag,
        tokenCiphertext: input.tokens.ciphertext,
        tokenIv: input.tokens.iv,
        tokenVersion: input.tokens.version,
      });
      return true;
    },
  };
  return { calls, repository, rows };
}

function stateCookie(overrides: Partial<Parameters<typeof signOAuthState>[0]> = {}) {
  return signOAuthState(
    {
      actorUserId: "user_1",
      provider: "x",
      returnTo: "/settings/connections",
      state: "csrf-state",
      verifier: "pkce-verifier",
      workspaceId: "ws_1",
      ...overrides,
    },
    SECRET,
    NOW,
  );
}

function callbackDeps(repository: ConnectedAccountRepository) {
  return {
    now: NOW,
    origin: "https://app.example.test",
    providerConfig: enabledConfig,
    recordAudit: vi.fn(async () => {}),
    repository,
    stateSecret: SECRET,
    vault,
  };
}

describe("prepareOAuthConnect", () => {
  it("returns unavailable for unknown or unconfigured providers", () => {
    expect(
      prepareOAuthConnect({
        actorUserId: "user_1",
        origin: "https://app.example.test",
        provider: "github",
        providerConfig: enabledConfig,
        returnTo: null,
        stateSecret: SECRET,
        workspaceId: "ws_1",
      }),
    ).toEqual({ kind: "unavailable" });
    expect(
      prepareOAuthConnect({
        actorUserId: "user_1",
        origin: "https://app.example.test",
        provider: "x",
        providerConfig: { enabled: false },
        returnTo: null,
        stateSecret: SECRET,
        workspaceId: "ws_1",
      }),
    ).toEqual({ kind: "unavailable" });
  });

  it("returns an authorize URL whose state + challenge match the signed cookie", () => {
    const outcome = prepareOAuthConnect({
      actorUserId: "user_1",
      now: NOW,
      origin: "https://app.example.test",
      provider: "x",
      providerConfig: enabledConfig,
      returnTo: "/settings/connections?tab=email",
      stateSecret: SECRET,
      workspaceId: "ws_1",
    });
    expect(outcome.kind).toBe("authorize");
    if (outcome.kind !== "authorize") return;

    const payload = verifyOAuthState(
      outcome.cookieValue,
      SECRET,
      { actorUserId: "user_1", provider: "x", workspaceId: "ws_1" },
      NOW,
    );
    expect(payload).not.toBeNull();
    expect(payload?.returnTo).toBe("/settings/connections?tab=email");

    const url = new URL(outcome.authorizeUrl);
    expect(url.origin + url.pathname).toBe("https://twitter.com/i/oauth2/authorize");
    expect(url.searchParams.get("state")).toBe(payload?.state);
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.test/api/accounts/x/callback",
    );
    expect(url.searchParams.get("client_id")).toBe("client-123");
  });

  it("sanitizes a hostile returnTo inside the signed state", () => {
    const outcome = prepareOAuthConnect({
      actorUserId: "user_1",
      now: NOW,
      origin: "https://app.example.test",
      provider: "x",
      providerConfig: enabledConfig,
      returnTo: "https://evil.example/steal",
      stateSecret: SECRET,
      workspaceId: "ws_1",
    });
    if (outcome.kind !== "authorize") throw new Error("expected authorize");
    const payload = verifyOAuthState(
      outcome.cookieValue,
      SECRET,
      { actorUserId: "user_1", provider: "x", workspaceId: "ws_1" },
      NOW,
    );
    expect(payload?.returnTo).toBe("/settings/connections");
  });
});

describe("handleOAuthCallback", () => {
  const baseInput = {
    actorUserId: "user_1",
    code: "auth-code",
    provider: "x",
    providerError: null,
    state: "csrf-state",
    workspaceId: "ws_1",
  };

  it("maps a state mismatch or missing cookie onto a generic error", async () => {
    const { repository } = fakeRepo();
    const deps = callbackDeps(repository);

    const mismatch = await handleOAuthCallback(
      { ...baseInput, state: "different-state", stateCookieValue: stateCookie() },
      deps,
    );
    expect(mismatch).toEqual({ returnTo: "/settings/connections", status: "error" });

    const missing = await handleOAuthCallback({ ...baseInput, stateCookieValue: null }, deps);
    expect(missing.status).toBe("error");

    const tampered = await handleOAuthCallback(
      { ...baseInput, stateCookieValue: `${stateCookie()}x` },
      deps,
    );
    expect(tampered.status).toBe("error");
  });

  it("rejects a state cookie signed for a different actor", async () => {
    const { repository } = fakeRepo();
    const outcome = await handleOAuthCallback(
      {
        ...baseInput,
        actorUserId: "user_2", // session user differs from the cookie signer
        stateCookieValue: stateCookie(),
      },
      callbackDeps(repository),
    );
    expect(outcome).toEqual({ returnTo: "/settings/connections", status: "error" });
  });

  it("maps access_denied onto denied; other provider errors stay generic", async () => {
    const { repository } = fakeRepo();
    const denied = await handleOAuthCallback(
      { ...baseInput, providerError: "access_denied", stateCookieValue: stateCookie() },
      callbackDeps(repository),
    );
    expect(denied).toEqual({ returnTo: "/settings/connections", status: "denied" });

    for (const providerError of ["temporarily_unavailable", "server_error", "invalid_scope"]) {
      const outcome = await handleOAuthCallback(
        { ...baseInput, providerError, stateCookieValue: stateCookie() },
        callbackDeps(repository),
      );
      expect(outcome).toEqual({ returnTo: "/settings/connections", status: "error" });
    }
  });

  it("returns unavailable for unconfigured providers", async () => {
    const { repository } = fakeRepo();
    const deps = {
      ...callbackDeps(repository),
      providerConfig: { enabled: false } as ConnectedAccountProviderConfig,
    };
    const outcome = await handleOAuthCallback(
      { ...baseInput, stateCookieValue: stateCookie() },
      deps,
    );
    expect(outcome.status).toBe("unavailable");
  });

  it("writes the account with an encrypted envelope on the happy path", async () => {
    const { calls, repository } = fakeRepo();
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href === "https://api.x.com/2/oauth2/token") {
        return jsonResponse(200, {
          access_token: "x-access",
          expires_in: 7200,
          refresh_token: "x-refresh",
          scope: "tweet.read users.read",
        });
      }
      if (href === "https://api.x.com/2/users/me") {
        return jsonResponse(200, { data: { id: "x-42", username: "acme" } });
      }
      throw new Error(`unexpected fetch: ${href}`);
    });
    const deps = {
      ...callbackDeps(repository),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    };

    const outcome = await handleOAuthCallback(
      { ...baseInput, stateCookieValue: stateCookie() },
      deps,
    );
    expect(outcome).toEqual({ returnTo: "/settings/connections", status: "connected" });

    expect(calls.put).toHaveLength(1);
    const put = calls.put[0]!;
    expect(put.provider).toBe("x");
    expect(put.externalAccountId).toBe("x-42");
    expect(put.label).toBe("@acme");
    expect(put.workspaceId).toBe("ws_1");
    expect(put.scopes).toEqual(["tweet.read", "users.read"]);
    expect(put.accessTokenExpiresAt).toEqual(new Date(NOW.getTime() + 7200 * 1000));

    // Envelope round-trips under the deterministic row id scope.
    expect(put.tokens).toBeTruthy();
    const decrypted = vault.decrypt(
      {
        accountId: "connected_account:ws_1:x:x-42",
        provider: "x",
        workspaceId: "ws_1",
      },
      put.tokens!,
    );
    expect(decrypted).toEqual({ accessToken: "x-access", refreshToken: "x-refresh" });

    expect(deps.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "connected_account.connected",
        actorUserId: "user_1",
        targetId: "connected_account:ws_1:x:x-42",
        targetType: "connected_account",
        workspaceId: "ws_1",
      }),
    );

    // The exchange went to the real adapter endpoints via fetchImpl.
    expect(fetchImpl.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://api.x.com/2/oauth2/token",
      "https://api.x.com/2/users/me",
    ]);
  });

  it("still reports connected when the audit sink throws", async () => {
    const { calls, repository } = fakeRepo();
    const fetchImpl = (async (url: string | URL) =>
      String(url) === "https://api.x.com/2/users/me"
        ? jsonResponse(200, { data: { id: "x-42", username: "acme" } })
        : jsonResponse(200, { access_token: "x-access" })) as typeof fetch;
    const deps = {
      ...callbackDeps(repository),
      fetchImpl,
      recordAudit: vi.fn(async () => {
        throw new Error("audit store down");
      }),
    };

    const outcome = await handleOAuthCallback(
      { ...baseInput, stateCookieValue: stateCookie() },
      deps,
    );
    expect(outcome.status).toBe("connected");
    expect(calls.put).toHaveLength(1);
  });

  it("maps an exchange failure onto a generic error and writes nothing", async () => {
    const { calls, repository } = fakeRepo();
    const deps = {
      ...callbackDeps(repository),
      fetchImpl: (async () => jsonResponse(500, {})) as typeof fetch,
    };
    const outcome = await handleOAuthCallback(
      { ...baseInput, stateCookieValue: stateCookie() },
      deps,
    );
    expect(outcome.status).toBe("error");
    expect(calls.put).toHaveLength(0);
  });
});

function serviceDeps(repository: ConnectedAccountRepository, fetchImpl?: typeof fetch) {
  return {
    captureException: vi.fn(),
    notifyReauth: vi.fn(async () => {}),
    now: () => NOW,
    providerConfig: () => enabledConfig,
    recordAudit: vi.fn(async () => {}),
    repository,
    vault,
    ...(fetchImpl !== undefined ? { fetchImpl } : {}),
  };
}

function rowWithTokens(tokens: { accessToken: string; refreshToken?: string }, overrides = {}) {
  const row = makeRow(overrides);
  const envelope = vault.encrypt(
    { accountId: row.id, provider: row.provider, workspaceId: row.workspaceId },
    tokens,
  );
  return makeRow({
    ...overrides,
    tokenAlgorithm: envelope.algorithm,
    tokenAuthTag: envelope.authTag,
    tokenCiphertext: envelope.ciphertext,
    tokenIv: envelope.iv,
    tokenVersion: envelope.version,
  });
}

describe("createConnectedAccountService.refresh", () => {
  it("returns not_found for a missing row", async () => {
    const { repository } = fakeRepo();
    const service = createConnectedAccountService(serviceDeps(repository));
    expect(await service.refresh("ws_1", "missing")).toEqual({ kind: "not_found", ok: false });
  });

  it("refreshes tokens and preserves a non-rotated refresh token", async () => {
    const row = rowWithTokens({ accessToken: "old-access", refreshToken: "old-refresh" });
    const { calls, repository, rows } = fakeRepo([row]);
    const fetchImpl = (async () =>
      jsonResponse(200, { access_token: "new-access", expires_in: 3600 })) as typeof fetch;
    const deps = serviceDeps(repository, fetchImpl);
    const service = createConnectedAccountService(deps);

    expect(await service.refresh("ws_1", row.id)).toEqual({ ok: true });

    expect(calls.updateTokens).toHaveLength(1);
    const updated = rows.get(row.id)!;
    const envelope = connectedAccountTokenEnvelope(updated)!;
    expect(
      vault.decrypt({ accountId: row.id, provider: "x", workspaceId: "ws_1" }, envelope),
    ).toEqual({ accessToken: "new-access", refreshToken: "old-refresh" });
    expect(updated.accessTokenExpiresAt).toEqual(new Date(NOW.getTime() + 3600 * 1000));
    expect(updated.status).toBe("active");
  });

  it("marks needs_reauth + notifies on invalid_grant", async () => {
    const row = rowWithTokens({ accessToken: "old-access", refreshToken: "dead-refresh" });
    const { calls, repository, rows } = fakeRepo([row]);
    const fetchImpl = (async () => jsonResponse(400, { error: "invalid_grant" })) as typeof fetch;
    const deps = serviceDeps(repository, fetchImpl);
    const service = createConnectedAccountService(deps);

    expect(await service.refresh("ws_1", row.id)).toEqual({ kind: "invalid_grant", ok: false });
    expect(calls.updateStatus).toEqual([
      {
        id: row.id,
        reason: "The provider rejected the stored grant.",
        status: "needs_reauth",
      },
    ]);
    expect(rows.get(row.id)?.status).toBe("needs_reauth");
    expect(deps.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "connected_account.token_refresh_failed" }),
    );
    expect(deps.notifyReauth).toHaveBeenCalledWith({
      accountLabel: "@acme",
      workspaceId: "ws_1",
    });
  });

  it("keeps writing status + audit on an already-flagged row without re-notifying", async () => {
    const row = rowWithTokens(
      { accessToken: "old-access", refreshToken: "dead-refresh" },
      { status: "needs_reauth" },
    );
    const { calls, repository } = fakeRepo([row]);
    const fetchImpl = (async () => jsonResponse(400, { error: "invalid_grant" })) as typeof fetch;
    const deps = serviceDeps(repository, fetchImpl);
    const service = createConnectedAccountService(deps);

    // A manual re-refresh of a needs_reauth row must not spam the workspace
    // with another notification — status + audit still record the attempt.
    expect(await service.refresh("ws_1", row.id)).toEqual({ kind: "invalid_grant", ok: false });
    expect(calls.updateStatus[0]?.status).toBe("needs_reauth");
    expect(deps.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "connected_account.token_refresh_failed" }),
    );
    expect(deps.notifyReauth).not.toHaveBeenCalled();
  });

  it("marks needs_reauth + notifies on terminal provider errors (invalid_client)", async () => {
    const row = rowWithTokens({ accessToken: "a", refreshToken: "r" });
    const { repository, rows } = fakeRepo([row]);
    const fetchImpl = (async () => jsonResponse(401, { error: "invalid_client" })) as typeof fetch;
    const deps = serviceDeps(repository, fetchImpl);
    const service = createConnectedAccountService(deps);

    expect(await service.refresh("ws_1", row.id)).toEqual({ kind: "terminal", ok: false });
    expect(rows.get(row.id)?.status).toBe("needs_reauth");
    expect(deps.notifyReauth).toHaveBeenCalledTimes(1);
  });

  it("flags needs_reauth when the stored envelope cannot be decrypted", async () => {
    // Corrupt the ciphertext AFTER rowWithTokens stamps the real envelope —
    // its token_* fields win over overrides.
    const row = makeRow({
      ...rowWithTokens({ accessToken: "a", refreshToken: "r" }),
      tokenCiphertext: "AAAAcorruptedciphertext",
    });
    const { calls, repository, rows } = fakeRepo([row]);
    const fetchImpl = (async () => {
      throw new Error("fetch must not run — decrypt fails first");
    }) as typeof fetch;
    const deps = serviceDeps(repository, fetchImpl);
    const service = createConnectedAccountService(deps);

    // Corrupt ciphertext is as unrecoverable as a rejected grant — the row
    // must exit the sweep pool instead of churning on every tick.
    expect(await service.refresh("ws_1", row.id)).toEqual({ kind: "terminal", ok: false });
    expect(rows.get(row.id)?.status).toBe("needs_reauth");
    expect(calls.updateStatus[0]?.status).toBe("needs_reauth");
    expect(deps.captureException).toHaveBeenCalledTimes(1);
    expect(deps.notifyReauth).toHaveBeenCalledTimes(1);
  });

  it("reports superseded when the row flipped non-active before the write", async () => {
    const row = rowWithTokens({ accessToken: "a", refreshToken: "r" }, { status: "needs_reauth" });
    const { repository, rows } = fakeRepo([row]);
    const fetchImpl = (async () =>
      jsonResponse(200, { access_token: "new-access", expires_in: 3600 })) as typeof fetch;
    const deps = serviceDeps(repository, fetchImpl);
    const service = createConnectedAccountService(deps);

    // The provider refresh succeeded, but the active-only updateTokens
    // predicate must refuse to resurrect a flagged row.
    expect(await service.refresh("ws_1", row.id)).toEqual({ kind: "superseded", ok: false });
    expect(rows.get(row.id)?.status).toBe("needs_reauth");
    expect(deps.notifyReauth).not.toHaveBeenCalled();
  });

  it("keeps a future stored expiry but repairs a past/missing one when expires_in is absent", async () => {
    const futureExpiry = new Date(NOW.getTime() + 2 * 3_600_000);
    const row = rowWithTokens(
      { accessToken: "a", refreshToken: "r" },
      { accessTokenExpiresAt: futureExpiry },
    );
    const { repository, rows } = fakeRepo([row]);
    const fetchImpl = (async () =>
      jsonResponse(200, { access_token: "new-access" })) as typeof fetch;
    const deps = serviceDeps(repository, fetchImpl);
    const service = createConnectedAccountService(deps);

    expect(await service.refresh("ws_1", row.id)).toEqual({ ok: true });
    // Stored expiry is still comfortably in the future → left untouched.
    expect(rows.get(row.id)?.accessTokenExpiresAt).toEqual(futureExpiry);

    const pastExpiry = new Date(NOW.getTime() - 60_000);
    const staleRow = rowWithTokens(
      { accessToken: "a", refreshToken: "r" },
      { accessTokenExpiresAt: pastExpiry, id: "connected_account:ws_1:x:stale" },
    );
    const second = fakeRepo([staleRow]);
    const secondService = createConnectedAccountService(serviceDeps(second.repository, fetchImpl));

    expect(await secondService.refresh("ws_1", staleRow.id)).toEqual({ ok: true });
    // Without a usable expires_in a past expiry would re-enter every sweep
    // tick — fall back to now + 3600s instead.
    expect(second.rows.get(staleRow.id)?.accessTokenExpiresAt).toEqual(
      new Date(NOW.getTime() + 3_600_000),
    );
  });

  it("marks needs_reauth when no refresh token is stored", async () => {
    const row = rowWithTokens({ accessToken: "access-only" });
    const { calls, repository } = fakeRepo([row]);
    const deps = serviceDeps(repository);
    const service = createConnectedAccountService(deps);

    expect(await service.refresh("ws_1", row.id)).toEqual({ kind: "invalid_grant", ok: false });
    expect(calls.updateStatus[0]?.status).toBe("needs_reauth");
    expect(deps.notifyReauth).toHaveBeenCalledTimes(1);
  });

  it("maps upstream failures without touching status", async () => {
    const row = rowWithTokens({ accessToken: "a", refreshToken: "r" });
    const { calls, repository, rows } = fakeRepo([row]);
    const fetchImpl = (async () => jsonResponse(503, {})) as typeof fetch;
    const deps = serviceDeps(repository, fetchImpl);
    const service = createConnectedAccountService(deps);

    expect(await service.refresh("ws_1", row.id)).toEqual({ kind: "upstream", ok: false });
    expect(calls.updateStatus).toHaveLength(0);
    expect(rows.get(row.id)?.status).toBe("active");
    expect(deps.captureException).toHaveBeenCalledTimes(1);
    expect(deps.notifyReauth).not.toHaveBeenCalled();
  });

  it("returns upstream for providers without an adapter or config", async () => {
    const row = rowWithTokens({ accessToken: "a", refreshToken: "r" }, { provider: "smtp" });
    const { repository } = fakeRepo([row]);
    const deps = {
      ...serviceDeps(repository),
      providerConfig: (): ConnectedAccountProviderConfig => ({ enabled: false }),
    };
    const service = createConnectedAccountService(deps);
    expect(await service.refresh("ws_1", row.id)).toEqual({ kind: "upstream", ok: false });
  });
});

describe("createConnectedAccountService.sweepExpiringTokens", () => {
  it("refreshes every expiring account and counts outcomes", async () => {
    const soon = new Date(NOW.getTime() + 60_000);
    const good = makeRow({ id: "connected_account:ws_1:x:good", accessTokenExpiresAt: soon });
    const goodEnvelope = vault.encrypt(
      { accountId: good.id, provider: "x", workspaceId: "ws_1" },
      { accessToken: "a", refreshToken: "r" },
    );
    const bad = makeRow({
      accessTokenExpiresAt: soon,
      externalAccountId: "bad",
      id: "connected_account:ws_1:x:bad",
      provider: "x",
    });
    const badEnvelope = vault.encrypt(
      { accountId: bad.id, provider: "x", workspaceId: "ws_1" },
      { accessToken: "a", refreshToken: "dead" },
    );
    // An expiring needs_reauth row must NOT be swept — only "active" rows
    // re-enter; flagged accounts would otherwise re-fail and re-notify on
    // every tick.
    const flagged = makeRow({
      accessTokenExpiresAt: soon,
      externalAccountId: "flagged",
      id: "connected_account:ws_1:x:flagged",
      provider: "x",
      status: "needs_reauth",
    });
    const flaggedEnvelope = vault.encrypt(
      { accountId: flagged.id, provider: "x", workspaceId: "ws_1" },
      { accessToken: "a", refreshToken: "dead" },
    );
    const { repository } = fakeRepo([
      makeRow({
        ...good,
        tokenAlgorithm: goodEnvelope.algorithm,
        tokenAuthTag: goodEnvelope.authTag,
        tokenCiphertext: goodEnvelope.ciphertext,
        tokenIv: goodEnvelope.iv,
        tokenVersion: goodEnvelope.version,
      }),
      makeRow({
        ...bad,
        tokenAlgorithm: badEnvelope.algorithm,
        tokenAuthTag: badEnvelope.authTag,
        tokenCiphertext: badEnvelope.ciphertext,
        tokenIv: badEnvelope.iv,
        tokenVersion: badEnvelope.version,
      }),
      makeRow({
        ...flagged,
        tokenAlgorithm: flaggedEnvelope.algorithm,
        tokenAuthTag: flaggedEnvelope.authTag,
        tokenCiphertext: flaggedEnvelope.ciphertext,
        tokenIv: flaggedEnvelope.iv,
        tokenVersion: flaggedEnvelope.version,
      }),
    ]);

    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const body = new URLSearchParams(init?.body as string);
      if (body.get("refresh_token") === "dead") {
        return jsonResponse(400, { error: "invalid_grant" });
      }
      return jsonResponse(200, { access_token: "fresh", expires_in: 3600 });
    });

    const deps = {
      captureException: vi.fn(),
      notifyReauth: vi.fn(async () => {}),
      now: () => NOW,
      providerConfig: () => enabledConfig,
      recordAudit: vi.fn(async () => {}),
      repository,
      vault,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    };
    const service = createConnectedAccountService(deps);
    const result = await service.sweepExpiringTokens({ now: NOW, limit: 10 });

    expect(result).toEqual({ failed: 1, refreshed: 1, skipped: 0 });
    // listExpiring was called with now + 5min lookahead.
    expect(deps.notifyReauth).toHaveBeenCalledTimes(1);
  });

  it("returns zeroes when listing fails instead of throwing", async () => {
    const repository: ConnectedAccountRepository = {
      ...fakeRepo().repository,
      async listExpiring() {
        throw new Error("database down");
      },
    };
    const deps = {
      captureException: vi.fn(),
      providerConfig: () => enabledConfig,
      repository,
      vault,
    };
    const service = createConnectedAccountService(deps);
    await expect(service.sweepExpiringTokens({ now: NOW })).resolves.toEqual({
      failed: 0,
      refreshed: 0,
      skipped: 0,
    });
    expect(deps.captureException).toHaveBeenCalledTimes(1);
  });

  it("runs the refresh under the per-account advisory lock and skips a busy lock", async () => {
    const row = rowWithTokens(
      { accessToken: "a", refreshToken: "r" },
      { accessTokenExpiresAt: new Date(NOW.getTime() + 60_000) },
    );
    const { repository } = fakeRepo([row]);
    const fetchImpl = (async () =>
      jsonResponse(200, { access_token: "new", expires_in: 3600 })) as typeof fetch;

    // Busy lock → the refresh is skipped, not failed, and the provider is
    // never called — that's the whole point of the lock.
    const busy = createConnectedAccountService({
      ...serviceDeps(repository, fetchImpl),
      withRefreshLock: async () => null,
    });
    expect(await busy.refresh("ws_1", row.id)).toEqual({ kind: "skipped", ok: false });

    // Acquired lock → the refresh runs inside it, keyed on the row id.
    const withRefreshLock = vi.fn(
      async (_accountId: string, run: () => Promise<ConnectedAccountRefreshResult>) => run(),
    );
    const locked = createConnectedAccountService({
      ...serviceDeps(repository, fetchImpl),
      withRefreshLock,
    });
    expect(await locked.refresh("ws_1", row.id)).toEqual({ ok: true });
    expect(withRefreshLock).toHaveBeenCalledWith(row.id, expect.any(Function));
  });

  it("counts lock-skipped accounts separately in the sweep", async () => {
    const soon = new Date(NOW.getTime() + 60_000);
    const a = rowWithTokens(
      { accessToken: "a", refreshToken: "r" },
      { accessTokenExpiresAt: soon, id: "connected_account:ws_1:x:a" },
    );
    const b = rowWithTokens(
      { accessToken: "a", refreshToken: "r" },
      { accessTokenExpiresAt: soon, id: "connected_account:ws_1:x:b" },
    );
    const { repository } = fakeRepo([a, b]);
    const fetchImpl = (async () =>
      jsonResponse(200, { access_token: "new", expires_in: 3600 })) as typeof fetch;
    const service = createConnectedAccountService({
      ...serviceDeps(repository, fetchImpl),
      // Account b is mid-refresh on another worker → busy lock.
      withRefreshLock: async (accountId, run) => (accountId === b.id ? null : run()),
    });

    const result = await service.sweepExpiringTokens({ now: NOW, limit: 10 });
    expect(result).toEqual({ failed: 0, refreshed: 1, skipped: 1 });
  });

  it("a re-entrant sweep skips accounts already in-flight in this process", async () => {
    const soon = new Date(NOW.getTime() + 60_000);
    const row = rowWithTokens(
      { accessToken: "a", refreshToken: "r" },
      { accessTokenExpiresAt: soon },
    );
    const { repository } = fakeRepo([row]);

    // Gate the provider call so the first sweep stays mid-refresh while a
    // second sweep runs in the same process.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchImpl = (async () => {
      await gate;
      return jsonResponse(200, { access_token: "new", expires_in: 3600 });
    }) as typeof fetch;
    const service = createConnectedAccountService(serviceDeps(repository, fetchImpl));

    const first = service.sweepExpiringTokens({ now: NOW, limit: 10 });
    // Let the first sweep reach the provider call (in-flight set populated).
    await new Promise((resolve) => setImmediate(resolve));

    const second = await service.sweepExpiringTokens({ now: NOW, limit: 10 });
    expect(second).toEqual({ failed: 0, refreshed: 0, skipped: 1 });

    release();
    expect(await first).toEqual({ failed: 0, refreshed: 1, skipped: 0 });
  });
});

describe("createConnectedAccountService.getDecrypted", () => {
  it("returns the decrypted token set or null", async () => {
    const row = makeRow();
    const envelope = vault.encrypt(
      { accountId: row.id, provider: "x", workspaceId: "ws_1" },
      { accessToken: "a", refreshToken: "r" },
    );
    const { repository } = fakeRepo([
      makeRow({
        tokenAlgorithm: envelope.algorithm,
        tokenAuthTag: envelope.authTag,
        tokenCiphertext: envelope.ciphertext,
        tokenIv: envelope.iv,
        tokenVersion: envelope.version,
      }),
    ]);
    const service = createConnectedAccountService({
      providerConfig: () => enabledConfig,
      repository,
      vault,
    });

    expect(await service.getDecrypted("ws_1", row.id)).toEqual({
      accessToken: "a",
      refreshToken: "r",
    });
    expect(await service.getDecrypted("ws_1", "missing")).toBeNull();
    expect(await service.getDecrypted("ws_other", row.id)).toBeNull();
  });
});

describe("smtpExternalAccountId", () => {
  it("joins normalized host and user", () => {
    expect(smtpExternalAccountId(" SMTP.Example.TEST ", "ada@example.test")).toBe(
      "smtp.example.test:ada@example.test",
    );
  });

  it("rejects empty inputs", () => {
    expect(() => smtpExternalAccountId("", "u")).toThrow();
    expect(() => smtpExternalAccountId("h", " ")).toThrow();
  });
});
