/**
 * Connected-account domain logic: the OAuth connect/callback
 * orchestration plus the token refresh service. Pure and dependency-injected —
 * `connected-accounts-runtime.ts` binds it to the real database, vault, audit,
 * notification, and observability singletons; unit tests supply fakes.
 */
import { generatePkce, getOAuthAdapter, OAuthProviderError } from "@supastack/auth/oauth-providers";
import type { OAuthProviderAdapter } from "@supastack/auth/oauth-providers";
import type { ConnectedAccountProviderConfig } from "@supastack/config";
import { AES_256_GCM, AUDIT_ACTIONS, connectedAccountRowId, ENVELOPE_VERSION } from "@supastack/db";
import type {
  AuditEventRecordInput,
  ConnectedAccount,
  ConnectedAccountRepository,
  ConnectedAccountTokenEnvelope,
  ConnectedAccountTokenSet,
  ConnectedAccountVault,
} from "@supastack/db";

import {
  DEFAULT_OAUTH_RETURN_TO,
  sanitizeOAuthReturnTo,
  signOAuthState,
  verifyOAuthState,
} from "./oauth-state";

export const CONNECTED_ACCOUNT_CALLBACK_PATH = "/api/accounts";
/** Refresh sweep acts on tokens expiring within this horizon. */
export const EXPIRING_TOKEN_LOOKAHEAD_MS = 5 * 60 * 1000;
export const DEFAULT_SWEEP_LIMIT = 50;
/**
 * When a refresh response omits `expires_in` and the stored expiry is
 * already past (or absent), the next expiry defaults to now + this many
 * seconds — a past expiry left in place would re-enter every sweep tick.
 */
export const REFRESH_FALLBACK_EXPIRES_SECONDS = 3600;

/* ------------------------------------------------------------------ *
 * Connect flow (GET /api/accounts/[provider]/connect)
 * ------------------------------------------------------------------ */

export type OAuthConnectOutcome =
  | Readonly<{ authorizeUrl: string; cookieValue: string; kind: "authorize" }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * Resolves the provider adapter + app credentials and, when both exist,
 * produces the PKCE authorize redirect and the signed state cookie value.
 */
export function prepareOAuthConnect(input: {
  readonly provider: string;
  readonly returnTo: string | null;
  readonly workspaceId: string;
  /** Session user starting the flow — signed into the state cookie. */
  readonly actorUserId: string;
  readonly providerConfig: ConnectedAccountProviderConfig;
  readonly stateSecret: string;
  /** App origin used to build the provider redirect_uri. */
  readonly origin: string;
  readonly now?: Date;
}): OAuthConnectOutcome {
  const adapter = getOAuthAdapter(input.provider);
  if (adapter === null || !input.providerConfig.enabled) {
    return { kind: "unavailable" };
  }

  const returnTo = sanitizeOAuthReturnTo(input.returnTo);
  const pkce = generatePkce();
  const cookieValue = signOAuthState(
    {
      actorUserId: input.actorUserId,
      provider: adapter.id,
      returnTo,
      state: pkce.state,
      verifier: pkce.verifier,
      workspaceId: input.workspaceId,
    },
    input.stateSecret,
    input.now,
  );

  const authorizeUrl = adapter.buildAuthorizeRequest({
    clientId: input.providerConfig.clientId,
    codeChallenge: pkce.challenge,
    redirectUri: `${input.origin}${CONNECTED_ACCOUNT_CALLBACK_PATH}/${adapter.id}/callback`,
    state: pkce.state,
    scopes: adapter.defaultScopes,
  });

  return { authorizeUrl: authorizeUrl.toString(), cookieValue, kind: "authorize" };
}

/* ------------------------------------------------------------------ *
 * Callback flow (GET /api/accounts/[provider]/callback)
 * ------------------------------------------------------------------ */

export type OAuthCallbackStatus = "connected" | "denied" | "error" | "unavailable";

export interface OAuthCallbackOutcome {
  /** Sanitized path the route should append `?status=` to. */
  readonly returnTo: string;
  readonly status: OAuthCallbackStatus;
}

export interface OAuthCallbackDeps {
  readonly providerConfig: ConnectedAccountProviderConfig;
  readonly stateSecret: string;
  readonly origin: string;
  readonly repository: ConnectedAccountRepository;
  readonly vault: ConnectedAccountVault;
  readonly recordAudit?: (input: AuditEventRecordInput) => Promise<void>;
  readonly fetchImpl?: typeof fetch;
  readonly now?: Date;
}

/**
 * Verifies the signed state cookie + echoed `state` param, exchanges the code,
 * resolves the external identity, then upserts the row with an AAD-bound
 * encrypted token envelope. Every failure maps onto a generic status — the
 * route never leaks provider detail through the redirect.
 */
export async function handleOAuthCallback(
  input: {
    readonly provider: string;
    readonly code: string | null;
    readonly state: string | null;
    readonly providerError: string | null;
    readonly stateCookieValue: string | null;
    readonly workspaceId: string;
    readonly actorUserId: string;
  },
  deps: OAuthCallbackDeps,
): Promise<OAuthCallbackOutcome> {
  const adapter = getOAuthAdapter(input.provider);
  if (adapter === null || !deps.providerConfig.enabled) {
    return { returnTo: DEFAULT_OAUTH_RETURN_TO, status: "unavailable" };
  }

  const payload = verifyOAuthState(
    input.stateCookieValue ?? "",
    deps.stateSecret,
    {
      actorUserId: input.actorUserId,
      provider: adapter.id,
      workspaceId: input.workspaceId,
    },
    deps.now,
  );
  const returnTo = sanitizeOAuthReturnTo(payload?.returnTo);
  if (payload === null || input.state === null || input.state !== payload.state) {
    return { returnTo, status: "error" };
  }
  if (input.providerError !== null) {
    // Only access_denied is a user "no"; every other provider error code
    // (temporarily_unavailable, server_error, …) stays a generic failure.
    return { returnTo, status: input.providerError === "access_denied" ? "denied" : "error" };
  }
  if (input.code === null || input.code.length === 0) {
    return { returnTo, status: "error" };
  }

  const now = deps.now ?? new Date();
  try {
    const tokens = await adapter.exchangeCode({
      clientId: deps.providerConfig.clientId,
      ...(deps.providerConfig.clientSecret !== undefined
        ? { clientSecret: deps.providerConfig.clientSecret }
        : {}),
      code: input.code,
      codeVerifier: payload.verifier,
      ...(deps.fetchImpl !== undefined ? { fetchImpl: deps.fetchImpl } : {}),
      redirectUri: `${deps.origin}${CONNECTED_ACCOUNT_CALLBACK_PATH}/${adapter.id}/callback`,
    });
    const identity = await adapter.fetchExternalIdentity({
      accessToken: tokens.accessToken,
      ...(deps.fetchImpl !== undefined ? { fetchImpl: deps.fetchImpl } : {}),
    });

    const accountId = connectedAccountRowId({
      externalAccountId: identity.externalAccountId,
      provider: adapter.id,
      workspaceId: input.workspaceId,
    });
    const envelope = deps.vault.encrypt(
      { accountId, provider: adapter.id, workspaceId: input.workspaceId },
      {
        accessToken: tokens.accessToken,
        ...(tokens.refreshToken !== undefined ? { refreshToken: tokens.refreshToken } : {}),
      },
    );
    await deps.repository.put({
      accessTokenExpiresAt:
        tokens.expiresInSeconds !== undefined
          ? new Date(now.getTime() + tokens.expiresInSeconds * 1000)
          : null,
      externalAccountId: identity.externalAccountId,
      label: identity.label,
      lastRefreshedAt: now,
      provider: adapter.id,
      scopes: tokens.scopes ?? [...adapter.defaultScopes],
      status: "active",
      tokens: envelope,
      workspaceId: input.workspaceId,
    });
    try {
      await deps.recordAudit?.({
        action: AUDIT_ACTIONS.connectedAccountConnected,
        actorUserId: input.actorUserId,
        metadata: { provider: adapter.id },
        targetId: accountId,
        targetType: "connected_account",
        workspaceId: input.workspaceId,
      });
    } catch {
      // The account IS connected — a failing audit sink must not flip the
      // outcome to "error" and make the user retry a working connect.
    }
    return { returnTo, status: "connected" };
  } catch {
    return { returnTo, status: "error" };
  }
}

/* ------------------------------------------------------------------ *
 * Token refresh service
 * ------------------------------------------------------------------ */

/**
 * `invalid_grant`/`terminal` mean the row was flagged `needs_reauth` (the
 * provider rejected the grant, or the failure — corrupt envelope, bad app
 * credentials — is just as unrecoverable). `superseded` means the refresh
 * succeeded upstream but the row flipped non-active before the write, so
 * the new tokens were dropped. `skipped` means another refresh held the
 * account's advisory lock — the account was left for the next sweep, not
 * failed.
 */
export type ConnectedAccountRefreshResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      kind: "invalid_grant" | "not_found" | "skipped" | "superseded" | "terminal" | "upstream";
    }>;

export interface ConnectedAccountServiceDeps {
  readonly repository: ConnectedAccountRepository;
  readonly vault: ConnectedAccountVault;
  /** Per-provider OAuth app config; unknown providers resolve disabled. */
  readonly providerConfig: (provider: string) => ConnectedAccountProviderConfig;
  readonly resolveAdapter?: (provider: string) => OAuthProviderAdapter | null;
  readonly notifyReauth?: (input: {
    readonly accountLabel: string;
    readonly workspaceId: string;
  }) => Promise<void>;
  readonly recordAudit?: (input: AuditEventRecordInput) => Promise<void>;
  readonly captureException?: (
    error: Error,
    context: { operation: string; workspaceId: string },
  ) => void;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  /**
   * Serialization guard around one account's refresh — the production
   * implementation takes `pg_try_advisory_xact_lock(hashtextextended(
   * account_id))` inside a transaction held for the duration of `run`, so
   * concurrent sweeps (overlapping ticks, a manual refresh racing the
   * sweep) can never spend the same rotating refresh token twice. `null`
   * means the lock was busy and the refresh must be skipped — providers
   * that rotate refresh tokens turn a double-refresh into a spurious
   * `invalid_grant` against a healthy account. Optional so tests and
   * embedders without a database can run unlocked.
   */
  readonly withRefreshLock?: (
    accountId: string,
    run: () => Promise<ConnectedAccountRefreshResult>,
  ) => Promise<ConnectedAccountRefreshResult | null>;
}

export interface ConnectedAccountService {
  refresh(workspaceId: string, accountId: string): Promise<ConnectedAccountRefreshResult>;
  sweepExpiringTokens(input?: {
    limit?: number;
    now?: Date;
  }): Promise<{ failed: number; refreshed: number; skipped: number }>;
  getDecrypted(workspaceId: string, accountId: string): Promise<ConnectedAccountTokenSet | null>;
}

/** Rebuilds the stored token envelope; null when the row carries no tokens. */
export function connectedAccountTokenEnvelope(
  row: ConnectedAccount,
): ConnectedAccountTokenEnvelope | null {
  if (
    row.tokenAlgorithm !== AES_256_GCM ||
    row.tokenVersion !== ENVELOPE_VERSION ||
    typeof row.tokenIv !== "string" ||
    typeof row.tokenAuthTag !== "string" ||
    typeof row.tokenCiphertext !== "string"
  ) {
    return null;
  }
  return {
    algorithm: row.tokenAlgorithm,
    authTag: row.tokenAuthTag,
    ciphertext: row.tokenCiphertext,
    iv: row.tokenIv,
    version: row.tokenVersion,
  };
}

export function createConnectedAccountService(
  deps: ConnectedAccountServiceDeps,
): ConnectedAccountService {
  const resolveAdapter = deps.resolveAdapter ?? getOAuthAdapter;
  const now = deps.now ?? (() => new Date());
  const capture = (error: unknown, workspaceId: string): void => {
    deps.captureException?.(asError(error), {
      operation: "connected-accounts.refresh",
      workspaceId,
    });
  };

  /**
   * needs_reauth + audit + workspace notification — never throws. The
   * notification only fires on the active → needs_reauth transition:
   * re-flagging an already-flagged row (e.g. a manual re-refresh) must not
   * spam the workspace again.
   */
  async function markNeedsReauth(row: ConnectedAccount, reason: string): Promise<void> {
    try {
      await deps.repository.updateStatus(row.workspaceId, row.id, "needs_reauth", reason);
    } catch (error) {
      capture(error, row.workspaceId);
    }
    try {
      await deps.recordAudit?.({
        action: AUDIT_ACTIONS.connectedAccountTokenRefreshFailed,
        metadata: { provider: row.provider, reason },
        targetId: row.id,
        targetType: "connected_account",
        workspaceId: row.workspaceId,
      });
    } catch (error) {
      capture(error, row.workspaceId);
    }
    if (row.status === "needs_reauth") {
      return;
    }
    try {
      await deps.notifyReauth?.({
        accountLabel: row.label ?? row.provider,
        workspaceId: row.workspaceId,
      });
    } catch (error) {
      capture(error, row.workspaceId);
    }
  }

  /**
   * Per-account serialization: when a `withRefreshLock` dep is wired the
   * whole read→provider-call→write sequence runs under the account's
   * advisory lock, and a busy lock reports `skipped` — the account waits
   * for the next sweep rather than racing a rotated refresh token.
   */
  async function refresh(
    workspaceId: string,
    accountId: string,
  ): Promise<ConnectedAccountRefreshResult> {
    if (deps.withRefreshLock === undefined) {
      return refreshInner(workspaceId, accountId);
    }
    try {
      const result = await deps.withRefreshLock(accountId, () =>
        refreshInner(workspaceId, accountId),
      );
      return result ?? { kind: "skipped", ok: false };
    } catch (error) {
      capture(error, workspaceId);
      return { kind: "upstream", ok: false };
    }
  }

  async function refreshInner(
    workspaceId: string,
    accountId: string,
  ): Promise<ConnectedAccountRefreshResult> {
    try {
      const row = await deps.repository.get(workspaceId, accountId);
      if (row === null) {
        return { kind: "not_found", ok: false };
      }
      const adapter = resolveAdapter(row.provider);
      const config = deps.providerConfig(row.provider);
      const envelope = connectedAccountTokenEnvelope(row);
      if (adapter === null || !config.enabled || envelope === null) {
        return { kind: "upstream", ok: false };
      }

      let stored: ConnectedAccountTokenSet;
      try {
        stored = deps.vault.decrypt(
          { accountId: row.id, provider: row.provider, workspaceId: row.workspaceId },
          envelope,
        );
      } catch (error) {
        capture(error, row.workspaceId);
        // An envelope that no longer decrypts is as unrecoverable as a
        // rejected grant — flag it so the sweep stops churning on it.
        await markNeedsReauth(row, "Stored account tokens could not be decrypted.");
        return { kind: "terminal", ok: false };
      }
      if (stored.refreshToken === undefined) {
        // Nothing renewable stored (e.g. consent granted without
        // offline access) — only reconnecting can fix it.
        await markNeedsReauth(row, "No refresh token stored for this account.");
        return { kind: "invalid_grant", ok: false };
      }

      let refreshed;
      try {
        refreshed = await adapter.refreshTokens({
          clientId: config.clientId,
          ...(config.clientSecret !== undefined ? { clientSecret: config.clientSecret } : {}),
          ...(deps.fetchImpl !== undefined ? { fetchImpl: deps.fetchImpl } : {}),
          refreshToken: stored.refreshToken,
        });
      } catch (error) {
        if (error instanceof OAuthProviderError && error.kind === "invalid_grant") {
          await markNeedsReauth(row, "The provider rejected the stored grant.");
          return { kind: "invalid_grant", ok: false };
        }
        if (error instanceof OAuthProviderError && error.kind === "terminal") {
          // invalid_client/unauthorized_client — the app's own credentials
          // were rejected; retrying can never succeed.
          await markNeedsReauth(row, "The provider rejected this app's credentials.");
          return { kind: "terminal", ok: false };
        }
        capture(error, row.workspaceId);
        return { kind: "upstream", ok: false };
      }

      // Providers rotate refresh tokens inconsistently — keep the stored one
      // when the response omits a replacement (stored.refreshToken is
      // guaranteed present by the early return above).
      const nextTokens: ConnectedAccountTokenSet = {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? stored.refreshToken,
      };
      const nextEnvelope = deps.vault.encrypt(
        { accountId: row.id, provider: row.provider, workspaceId: row.workspaceId },
        nextTokens,
      );
      const refreshedAt = now();
      const accessTokenExpiresAt = resolveRefreshedExpiry(
        refreshed.expiresInSeconds,
        row.accessTokenExpiresAt,
        refreshedAt,
      );
      const written = await deps.repository.updateTokens(workspaceId, row.id, {
        tokens: nextEnvelope,
        ...(accessTokenExpiresAt !== undefined ? { accessTokenExpiresAt } : {}),
      });
      if (!written) {
        // The row flipped needs_reauth/revoked (or was deleted) while the
        // upstream call ran — the fresh tokens are dropped, never applied.
        return { kind: "superseded", ok: false };
      }
      return { ok: true };
    } catch (error) {
      capture(error, workspaceId);
      return { kind: "upstream", ok: false };
    }
  }

  /**
   * In-process re-entrancy guard: two overlapping sweep calls in this
   * process share the set, so the second skips accounts the first is
   * mid-refresh on. Cross-process exclusion is the advisory lock inside
   * `refresh` — the Set only covers same-process overlap where a second
   * sweep would still list (and re-attempt) an in-flight account.
   */
  const inFlightRefreshes = new Set<string>();

  return Object.freeze({
    refresh,

    async sweepExpiringTokens(input?: { limit?: number; now?: Date }) {
      const sweepNow = input?.now ?? now();
      const limit = input?.limit ?? DEFAULT_SWEEP_LIMIT;
      const horizon = new Date(sweepNow.getTime() + EXPIRING_TOKEN_LOOKAHEAD_MS);
      let rows: ConnectedAccount[];
      try {
        rows = await deps.repository.listExpiring(horizon, limit);
      } catch (error) {
        capture(error, "platform");
        return { failed: 0, refreshed: 0, skipped: 0 };
      }

      let refreshed = 0;
      let failed = 0;
      let skipped = 0;
      for (const row of rows) {
        if (inFlightRefreshes.has(row.id)) {
          skipped += 1;
          continue;
        }
        inFlightRefreshes.add(row.id);
        try {
          const result = await refresh(row.workspaceId, row.id);
          if (result.ok) {
            refreshed += 1;
          } else if (result.kind === "skipped") {
            skipped += 1;
          } else {
            failed += 1;
          }
        } finally {
          inFlightRefreshes.delete(row.id);
        }
      }
      return { failed, refreshed, skipped };
    },

    async getDecrypted(workspaceId: string, accountId: string) {
      const row = await deps.repository.get(workspaceId, accountId);
      if (row === null) {
        return null;
      }
      const envelope = connectedAccountTokenEnvelope(row);
      if (envelope === null) {
        return null;
      }
      try {
        return deps.vault.decrypt(
          { accountId: row.id, provider: row.provider, workspaceId: row.workspaceId },
          envelope,
        );
      } catch {
        return null;
      }
    },
  });
}

/**
 * SMTP connected accounts key their identity on `"{host}:{user}"`. The ":"
 * means the deterministic row id cannot be generated, so `put` callers must
 * also pass an explicit `id`.
 */
export function smtpExternalAccountId(host: string, user: string): string {
  const normalizedHost = host.trim().toLowerCase();
  const normalizedUser = user.trim();
  if (normalizedHost.length === 0 || normalizedUser.length === 0) {
    throw new Error("A valid SMTP host and user are required.");
  }
  return `${normalizedHost}:${normalizedUser}`;
}

/**
 * Picks the expiry stored alongside freshly refreshed tokens. A usable
 * `expires_in` always wins. When the response omits it: a stored expiry
 * still in the future is kept (undefined → the write leaves the column
 * untouched), while a missing or already-past expiry is repaired to
 * `now + REFRESH_FALLBACK_EXPIRES_SECONDS` so the row can't re-enter the
 * sweep on every tick.
 */
function resolveRefreshedExpiry(
  expiresInSeconds: number | undefined,
  storedExpiry: Date | null,
  now: Date,
): Date | undefined {
  if (expiresInSeconds !== undefined) {
    return new Date(now.getTime() + expiresInSeconds * 1000);
  }
  if (storedExpiry !== null && storedExpiry.getTime() > now.getTime()) {
    return undefined;
  }
  return new Date(now.getTime() + REFRESH_FALLBACK_EXPIRES_SECONDS * 1000);
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("Unknown connected-account failure");
}
