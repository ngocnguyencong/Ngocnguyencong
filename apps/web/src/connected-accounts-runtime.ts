import "server-only";

import { parseServerConfig, type ConnectedAccountProviderConfig } from "@supastack/config";
import {
  createConnectedAccountVault,
  createDrizzleConnectedAccountRepository,
  type ConnectedAccountRepository,
  type ConnectedAccountTokenSet,
  type ConnectedAccountVault,
} from "@supastack/db";
import { sql } from "drizzle-orm";

import { recordAuditEvent, recordSystemAuditEvent } from "./audit-runtime";
import { database } from "./auth-runtime";
import { isOAuthConnectedProvider } from "./connected-accounts";
import {
  createConnectedAccountService,
  handleOAuthCallback,
  prepareOAuthConnect,
  smtpExternalAccountId,
  type ConnectedAccountRefreshResult,
  type ConnectedAccountService,
  type OAuthCallbackOutcome,
  type OAuthConnectOutcome,
} from "./connected-account-service";
import { serverObservability } from "./observability-runtime";
import { DEFAULT_OAUTH_RETURN_TO } from "./oauth-state";

const serverConfig = parseServerConfig();

let repository: ConnectedAccountRepository | null = null;
/** Lazily composed — storage-only, never sees plaintext tokens. */
export function getConnectedAccountRepository(): ConnectedAccountRepository {
  repository ??= createDrizzleConnectedAccountRepository(database);
  return repository;
}

let vault: ConnectedAccountVault | null = null;
/**
 * Lazily composed so an unconfigured/invalid CREDENTIAL_ENCRYPTION_KEY only
 * fails when a token operation is attempted, not at module load.
 */
export function getConnectedAccountVault(): ConnectedAccountVault {
  vault ??= createConnectedAccountVault(serverConfig.auth.credentialEncryptionKey);
  return vault;
}

/** OAuth app credentials for a connected-account provider (unknown → disabled). */
export function connectedAccountProviderConfig(provider: string): ConnectedAccountProviderConfig {
  // Provider ids double as the serverConfig.connectedAccounts keys — the
  // shared OAUTH_PROVIDERS registry in connected-accounts.ts owns the list.
  return isOAuthConnectedProvider(provider)
    ? serverConfig.connectedAccounts[provider]
    : { enabled: false };
}

/* ------------------------------------------------------------------ *
 * Route-bound wrappers (connect + callback)
 * ------------------------------------------------------------------ */

export function prepareConnectedAccountConnect(input: {
  readonly provider: string;
  readonly returnTo: string | null;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly origin: string;
}): OAuthConnectOutcome {
  return prepareOAuthConnect({
    ...input,
    providerConfig: connectedAccountProviderConfig(input.provider),
    stateSecret: serverConfig.auth.secret,
  });
}

export async function handleConnectedAccountCallback(input: {
  readonly provider: string;
  readonly code: string | null;
  readonly state: string | null;
  readonly providerError: string | null;
  readonly stateCookieValue: string | null;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly origin: string;
}): Promise<OAuthCallbackOutcome> {
  let vault: ConnectedAccountVault;
  try {
    vault = getConnectedAccountVault();
  } catch {
    // A malformed CREDENTIAL_ENCRYPTION_KEY (the dev placeholder included)
    // throws ConnectedAccountVaultError — map it onto the generic status
    // instead of letting it escape as a route-level 500.
    return { returnTo: DEFAULT_OAUTH_RETURN_TO, status: "error" };
  }
  return handleOAuthCallback(input, {
    origin: input.origin,
    providerConfig: connectedAccountProviderConfig(input.provider),
    recordAudit: recordAuditEvent,
    repository: getConnectedAccountRepository(),
    stateSecret: serverConfig.auth.secret,
    vault,
  });
}

/* ------------------------------------------------------------------ *
 * Refresh service (manual calls + the K5 scheduler sweep)
 * ------------------------------------------------------------------ */

let service: ConnectedAccountService | null = null;
function getService(): ConnectedAccountService {
  service ??= createConnectedAccountService({
    captureException: (error, context) => serverObservability.captureException(error, context),
    notifyReauth: async ({ accountLabel, workspaceId }) => {
      // Lazy import keeps the email sender out of the cold path.
      const { tryEmitProductNotification } = await import("./notification-runtime");
      await tryEmitProductNotification({
        accountLabel,
        type: "connected_account.token_refresh_failed",
        workspaceId,
      });
    },
    providerConfig: connectedAccountProviderConfig,
    recordAudit: recordSystemAuditEvent,
    repository: getConnectedAccountRepository(),
    vault: getConnectedAccountVault(),
    /**
     * Per-account refresh serialization across processes: a transaction
     * takes `pg_try_advisory_xact_lock` keyed on the account row id and
     * holds it for the whole refresh (read → provider call → write). A
     * busy lock resolves `null` — the account is skipped, not failed.
     * `hashtextextended` matches the billing webhook's keying convention.
     */
    withRefreshLock: (accountId, run) =>
      database.transaction(async (tx) => {
        const rows = await tx.execute<{ locked: boolean }>(
          sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${accountId}, 0)) AS "locked"`,
        );
        if (rows[0]?.locked !== true) {
          return null;
        }
        return run();
      }),
  });
  return service;
}

/**
 * Service construction can still throw when the vault key is malformed —
 * keep that misconfiguration from crashing manual refreshes or a scheduler
 * tick; each entrypoint degrades to its never-throw contract.
 */
function tryGetService(): ConnectedAccountService | null {
  try {
    return getService();
  } catch (error) {
    serverObservability.captureException(error as Error, {
      operation: "connected-accounts.service",
      workspaceId: "platform",
    });
    return null;
  }
}

export async function refreshConnectedAccount(
  workspaceId: string,
  accountId: string,
): Promise<ConnectedAccountRefreshResult> {
  const service = tryGetService();
  if (service === null) {
    return { kind: "upstream", ok: false };
  }
  return service.refresh(workspaceId, accountId);
}

export async function sweepExpiringTokens(input?: {
  limit?: number;
  now?: Date;
}): Promise<{ failed: number; refreshed: number; skipped: number }> {
  const service = tryGetService();
  if (service === null) {
    return { failed: 0, refreshed: 0, skipped: 0 };
  }
  return service.sweepExpiringTokens(input);
}

/** Decrypt-only read for future send paths — compose a refresh first if needed. */
export async function getConnectedAccountDecrypted(
  workspaceId: string,
  accountId: string,
): Promise<ConnectedAccountTokenSet | null> {
  const service = tryGetService();
  if (service === null) {
    return null;
  }
  return service.getDecrypted(workspaceId, accountId);
}

export { smtpExternalAccountId };
