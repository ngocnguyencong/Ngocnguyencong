import { parseServerConfig } from "@supastack/config";
import type { EarlyAccessHooks } from "@supastack/auth/server";
import { AUDIT_ACTIONS, createPostgresDatabase, user } from "@supastack/db";
import { eq } from "drizzle-orm";

import {
  createAuthMagicLinkDelivery,
  createAuthMailAdmission,
  createAuthOtpDelivery,
} from "./auth-otp-delivery";
import { normalizeAuthSession, type AuthSessionIdentity } from "./auth-session";
import { getAuthJsSession, resolveAuthJsSessionIdentity } from "./authjs-session";
import { resolveGithubConnection, type GithubConnectionState } from "./github-connection";
import { createWebAuthServer } from "./auth-server";
import { createAuthRecoveryApiKeyRevoker } from "./auth-recovery-api-keys";
import { handleEarlyAccessUserCreated, validateEarlyAccessCode } from "./growth/early-access";
import { INVITE_COOKIE, REFERRAL_COOKIE } from "./growth/growth-cookies";
import { createGrowthStore } from "./growth/growth-store";
import { sanitizeGrowthParam } from "./growth/waitlist";
import { createServerTransactionalEmailSender } from "./server-provider-composition";

const serverConfig = parseServerConfig();

export const database = createPostgresDatabase({ databaseUrl: serverConfig.databaseUrl }).database;

export const authEngine = serverConfig.auth.engine;
export const githubOAuthEnabled = serverConfig.auth.providers.github.enabled;

const transactionalEmail = createServerTransactionalEmailSender(serverConfig.providers.email);
const admitAuthMail = createAuthMailAdmission(serverConfig.auth.secret);

const growthStore = createGrowthStore(database);

const earlyAccess: EarlyAccessHooks = {
  cookies: { invite: INVITE_COOKIE, referral: REFERRAL_COOKIE },
  sanitize: sanitizeGrowthParam,
  validateCode: ({ code, email }) =>
    validateEarlyAccessCode(growthStore, { code, email, now: new Date() }),
  onCreated: async ({ user, invite, referral }) => {
    try {
      const outcome = await handleEarlyAccessUserCreated(growthStore, {
        user,
        invite,
        referral,
        now: new Date(),
      });
      if (outcome.redeemedCode) {
        // Lazy import: audit-runtime pulls `database` from this module.
        const { recordAuditEvent } = await import("./audit-runtime");
        await recordAuditEvent({
          action: AUDIT_ACTIONS.earlyAccessCodeRedeemed,
          metadata: { code: outcome.redeemedCode },
          targetId: user.id,
          targetType: "user",
        });
      }
    } catch (error) {
      // Referral/invite bookkeeping must never fail account creation.
      console.error("early-access post-create handling failed", {
        userId: user.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  },
};

/** Shared server-only auth/database composition for Next route handlers. */
export const auth = createWebAuthServer({
  admitAuthMail,
  database,
  // Lazy import: custom-domains/runtime pulls `database` from this module.
  dynamicTrustedOrigins: async () =>
    (await import("./custom-domains/runtime")).resolveTrustedDomainOrigins(),
  earlyAccess,
  revokeUserApiKeys: createAuthRecoveryApiKeyRevoker(database),
  sendMagicLink: createAuthMagicLinkDelivery(transactionalEmail),
  sendVerificationOTP: createAuthOtpDelivery(transactionalEmail),
  serverConfig,
});

/**
 * Auth.js engine instance — null unless AUTH_PROVIDER=authjs. Keeps the shared
 * `user` table via sign-in upserts and verifies credentials against the same
 * account password hashes.
 */
// next-auth is only loaded for the authjs engine so the default better-auth
// graph never pulls in the extra dependency (and vitest stays offline-safe).
export const authjs =
  authEngine === "authjs"
    ? (await import("./authjs-runtime")).createAuthJs({ database, earlyAccess, serverConfig })
    : null;

/** Returns only the validated identity required by workspace-scoped BFFs. */
export async function getAuthSession(headers: Headers): Promise<AuthSessionIdentity | null> {
  if (authjs !== null) {
    const session = await getAuthJsSession(serverConfig.auth.secret, headers);
    // The Auth.js cookie can outlive an account ban or verification change.
    // Resolve current row state for every request before trusting its user id.
    return resolveAuthJsSessionIdentity(
      session,
      async (userId) =>
        await database.query.user.findFirst({
          columns: { banned: true, email: true, emailVerified: true },
          where: eq(user.id, userId),
        }),
    );
  }

  const session: unknown = await auth.api.getSession({ headers });
  return normalizeAuthSession(session);
}

/** Dashboard-safe GitHub identity projection; OAuth tokens remain server-only. */
export async function getGithubConnection(headers: Headers): Promise<GithubConnectionState> {
  return resolveGithubConnection(
    { enabled: githubOAuthEnabled, engine: authEngine },
    {
      listAccounts: async () => await auth.api.listUserAccounts({ headers }),
      getAccessToken: async (accountId) => {
        const result = await auth.api.getAccessToken({
          body: { accountId },
          headers,
        });
        return result.accessToken ?? null;
      },
      fetchProfile: async (accessToken) => {
        const response = await fetch("https://api.github.com/user", {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${accessToken}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });
        if (!response.ok) throw new Error(`GitHub profile lookup failed (${response.status})`);
        return (await response.json()) as {
          avatar_url?: string | null;
          html_url?: string | null;
          login?: string | null;
          name?: string | null;
        };
      },
    },
  );
}
