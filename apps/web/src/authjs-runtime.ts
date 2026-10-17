import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import type { EarlyAccessHooks } from "@supastack/auth/server";
import type { OAuthProviderConfig, ServerConfig } from "@supastack/config";
import { account, user } from "@supastack/db";
import type { PostgresDatabaseLifecycle } from "@supastack/db";
import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import NextAuth, { type NextAuthConfig } from "next-auth";
import type { NextRequest } from "next/server";
import type { Provider } from "next-auth/providers";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import Twitter from "next-auth/providers/twitter";

import { AUTHJS_IDENTITY_VERSION } from "./authjs-session";

type Database = PostgresDatabaseLifecycle["database"];

const CREDENTIAL_ATTEMPT_LIMIT = 3;
const CREDENTIAL_ATTEMPT_WINDOW_MS = 10_000;
const CREDENTIAL_ATTEMPT_MAX_BUCKETS = 4_096;

function createCredentialAttemptGate(secret: string): (email: string) => boolean {
  const attempts = new Map<string, { count: number; expiresAt: number }>();
  return (email) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || normalized.length > 320) return false;
    const now = Date.now();
    const key = createHmac("sha256", secret).update(normalized).digest("base64url");
    const current = attempts.get(key);
    if (current && current.expiresAt > now && current.count >= CREDENTIAL_ATTEMPT_LIMIT)
      return false;
    if (current && current.expiresAt > now) {
      current.count += 1;
      attempts.delete(key);
      attempts.set(key, current);
    } else {
      attempts.delete(key);
      attempts.set(key, { count: 1, expiresAt: now + CREDENTIAL_ATTEMPT_WINDOW_MS });
    }
    for (const [bucketKey, bucket] of attempts) {
      if (bucket.expiresAt <= now) attempts.delete(bucketKey);
    }
    while (attempts.size > CREDENTIAL_ATTEMPT_MAX_BUCKETS) {
      const oldestKey = attempts.keys().next().value;
      if (oldestKey === undefined) break;
      attempts.delete(oldestKey);
    }
    return true;
  };
}

export type AuthJsDependencies = Readonly<{
  database: Database;
  earlyAccess?: EarlyAccessHooks | undefined;
  serverConfig: ServerConfig;
}>;

type AuthJsSocialSignupContext = Readonly<{
  earlyAccess: EarlyAccessHooks | undefined;
  invite: string | null;
  referral: string | null;
}>;

type ActiveAuthJsUser = Readonly<{
  banned: false;
  email: string;
  emailVerified: true;
  id: string;
  role: string;
}>;

async function findActiveAuthJsUser(
  database: AuthJsDependencies["database"],
  userId: string,
): Promise<ActiveAuthJsUser | null> {
  const current = await database.query.user.findFirst({
    columns: { banned: true, email: true, emailVerified: true, id: true, role: true },
    where: eq(user.id, userId),
  });
  if (current === undefined || current.banned || !current.emailVerified) return null;
  return current as ActiveAuthJsUser;
}

function clearAuthJsIdentity(token: Record<string, unknown>): void {
  delete token.email;
  delete token.identityVersion;
  delete token.role;
  delete token.sub;
  delete token.userId;
}

function enabledSocialProviders(providers: ServerConfig["auth"]["providers"]) {
  const catalog: ReadonlyArray<
    readonly [OAuthProviderConfig, (clientId: string, clientSecret: string) => Provider]
  > = [
    [providers.apple, (clientId, clientSecret) => Apple({ clientId, clientSecret })],
    [providers.github, (clientId, clientSecret) => GitHub({ clientId, clientSecret })],
    [providers.google, (clientId, clientSecret) => Google({ clientId, clientSecret })],
    [providers.microsoft, (clientId, clientSecret) => MicrosoftEntraId({ clientId, clientSecret })],
    [providers.twitter, (clientId, clientSecret) => Twitter({ clientId, clientSecret })],
  ];

  return catalog.flatMap(([provider, build]) =>
    provider.enabled ? [build(provider.clientId, provider.clientSecret)] : [],
  );
}

/**
 * Resolves the local `user` row for an Auth.js social sign-in, or `null` to
 * deny it. An existing provider-scoped `account` link
 * (`issuer = "authjs:<provider>"`, `account_id = providerAccountId`) always
 * wins — the provider account proved control of the local user once, so a
 * changed or dropped email claim can never re-key the identity. Without a
 * prior link, only a provider-verified email may select or create a `user`
 * row; the `signIn` callback turns `null` into an Auth.js sign-in failure.
 */
export async function linkAuthJsSocialUser(
  database: AuthJsDependencies["database"],
  serverConfig: ServerConfig,
  identity: Readonly<{
    email: string | null | undefined;
    emailVerified: boolean;
    image?: string | null;
    name?: string | null;
    provider: string;
    providerAccountId: string;
  }>,
  signupContext?: AuthJsSocialSignupContext,
): Promise<{ id: string } | null> {
  const issuer = `authjs:${identity.provider}`;
  const resolved = await database.transaction(async (tx) => {
    const linked = await tx.query.account.findFirst({
      columns: { userId: true },
      where: and(eq(account.issuer, issuer), eq(account.accountId, identity.providerAccountId)),
    });
    if (linked !== undefined) {
      const linkedUser = await tx.query.user.findFirst({
        columns: { banned: true, emailVerified: true, id: true },
        where: eq(user.id, linked.userId),
      });
      if (linkedUser?.emailVerified !== true || linkedUser.banned) return null;
      // Legacy mailbox recovery deletes old account links before verifying
      // the user. Do not authenticate through a link read before that cleanup.
      const activeLink = await tx.query.account.findFirst({
        columns: { userId: true },
        where: and(eq(account.issuer, issuer), eq(account.accountId, identity.providerAccountId)),
      });
      return activeLink?.userId === linkedUser.id ? { id: linkedUser.id } : null;
    }

    // Never key a `user` row on an unverified provider email claim: an
    // attacker-controlled provider account could otherwise take over an
    // existing user, squat a future signup (`user.email` is unique), accept
    // workspace invitations matched by email, or merge the victim's later
    // verified sign-in into the attacker's row.
    const email = identity.email?.trim().toLowerCase();
    if (!email || !identity.emailVerified) return null;

    // Concurrent social sign-ins pass both reads above before either
    // transaction commits: a doubled provider callback collides on
    // `idx_account_issuer_account`, and two providers racing one email
    // collide on `idx_user_email`. Postgres aborts the whole transaction on
    // a raised 23505, so both inserts instead DO NOTHING on conflict and the
    // committed winner's row is re-read — our skipped values never decide.
    const existing = await tx.query.user.findFirst({
      columns: { banned: true, emailVerified: true, id: true, role: true },
      where: eq(user.email, email),
    });
    // Proof from a new provider identity must not activate a legacy local
    // password row. That row may have been registered by an attacker before
    // the mailbox owner arrived; first-time linking requires an already
    // verified local identity or a genuinely new user row.
    if (existing !== undefined && (existing.banned || !existing.emailVerified)) return null;
    let owner = existing;
    let createdUserId: string | null = null;
    if (owner === undefined) {
      const emailIsAdmin = serverConfig.admin.emails.some(
        (adminEmail) => adminEmail.toLowerCase() === email,
      );
      if (serverConfig.earlyAccess.inviteOnly && !emailIsAdmin) {
        const hooks = signupContext?.earlyAccess;
        const invite = signupContext?.invite;
        if (!hooks || !invite) return null;
        if ((await hooks.validateCode({ code: invite, email })) !== "valid") return null;
      }

      const insertedUsers = await tx
        .insert(user)
        .values({
          email,
          emailVerified: true,
          id: `usr_${randomUUID().replaceAll("-", "")}`,
          image: identity.image ?? null,
          name: identity.name ?? email.split("@")[0] ?? "User",
          role: emailIsAdmin ? "admin" : "user",
        })
        .onConflictDoNothing({ target: user.email })
        .returning({ id: user.id });
      createdUserId = insertedUsers[0]?.id ?? null;
      owner = await tx.query.user.findFirst({
        columns: { banned: true, emailVerified: true, id: true, role: true },
        where: eq(user.email, email),
      });
      if (owner === undefined) {
        throw new Error("Auth.js social sign-in could not resolve its user row.");
      }
      if (owner.banned || !owner.emailVerified) return null;
    } else if (serverConfig.admin.emails.includes(email) && owner.role !== "admin") {
      await tx.update(user).set({ role: "admin" }).where(eq(user.id, owner.id));
    }
    await tx
      .insert(account)
      .values({
        accountId: identity.providerAccountId,
        id: `acct_${randomUUID().replaceAll("-", "")}`,
        issuer,
        providerId: identity.provider,
        userId: owner.id,
      })
      .onConflictDoNothing({ target: [account.issuer, account.accountId] });
    const winner = await tx.query.account.findFirst({
      columns: { userId: true },
      where: and(eq(account.issuer, issuer), eq(account.accountId, identity.providerAccountId)),
    });
    if (winner === undefined) {
      throw new Error("Auth.js social sign-in could not resolve its account link.");
    }
    const winnerUser = await tx.query.user.findFirst({
      columns: { banned: true, emailVerified: true, id: true },
      where: eq(user.id, winner.userId),
    });
    return winnerUser?.emailVerified === true && !winnerUser.banned
      ? { id: winnerUser.id, created: createdUserId === winnerUser.id }
      : null;
  });
  if (resolved?.created) {
    await signupContext?.earlyAccess?.onCreated?.({
      user: { email: identity.email!.trim().toLowerCase(), id: resolved.id },
      invite: signupContext.invite,
      referral: signupContext.referral,
    });
  }
  return resolved === null ? null : { id: resolved.id };
}

async function socialEmailVerified(
  provider: string,
  email: string | null | undefined,
  accessToken: string | undefined,
  rawProfile: Record<string, unknown> | undefined,
): Promise<boolean> {
  if (
    (provider === "apple" || provider === "google") &&
    (rawProfile?.email_verified === true || rawProfile?.email_verified === "true")
  ) {
    return true;
  }
  if (provider !== "github" || !email || !accessToken) return false;
  try {
    const response = await fetch("https://api.github.com/user/emails", {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${accessToken}` },
      // Never follow redirects — a redirect target would receive the bearer token.
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return false;
    const emailRows: unknown[] = rows;
    return emailRows.some(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        "email" in row &&
        typeof row.email === "string" &&
        row.email.toLowerCase() === email.toLowerCase() &&
        "verified" in row &&
        row.verified === true,
    );
  } catch {
    return false;
  }
}

async function verifyCredentials(
  database: AuthJsDependencies["database"],
  email: string,
  password: string,
): Promise<{ email: string; id: string; name: string | null } | null> {
  const owner = await database.query.user.findFirst({
    columns: { banned: true, email: true, emailVerified: true, id: true, name: true },
    where: eq(user.email, email.trim().toLowerCase()),
  });
  if (owner === undefined || !owner.emailVerified || owner.banned) {
    return null;
  }

  const [credential] = await database
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, owner.id), eq(account.providerId, "credential")))
    .limit(1);
  if (credential?.password === undefined || credential.password === null) {
    return null;
  }

  const valid = await verifyPassword({ hash: credential.password, password });
  return valid ? owner : null;
}

/**
 * Second supported auth engine (Auth.js v5). JWT sessions keep the deployment
 * table-free while sharing the `user` table for workspace joins. Better Auth
 * plugin features (impersonation, passkeys, TOTP, OTP, magic link, expo) are
 * intentionally not available on this engine.
 */
export function createAuthJs(dependencies: AuthJsDependencies) {
  const { database, serverConfig } = dependencies;
  const allowCredentialAttempt = createCredentialAttemptGate(serverConfig.auth.secret);

  const config = (request: NextRequest | undefined): NextAuthConfig => {
    const earlyAccess = dependencies.earlyAccess;
    const invite =
      earlyAccess?.sanitize(request?.cookies.get(earlyAccess.cookies.invite)?.value ?? null) ??
      null;
    const referral =
      earlyAccess?.sanitize(request?.cookies.get(earlyAccess.cookies.referral)?.value ?? null) ??
      null;

    return {
      basePath: "/api/auth",
      callbacks: {
        async signIn({ user: profileUser, account: authAccount, profile: rawProfile }) {
          if (authAccount?.provider === "credentials") return true;
          if (!authAccount?.provider || !authAccount.providerAccountId) return false;
          const email = profileUser.email;
          const owner = await linkAuthJsSocialUser(
            database,
            serverConfig,
            {
              email,
              emailVerified: await socialEmailVerified(
                authAccount.provider,
                email,
                authAccount.access_token,
                rawProfile,
              ),
              image: profileUser.image ?? null,
              name: profileUser.name ?? null,
              provider: authAccount.provider,
              providerAccountId: authAccount.providerAccountId,
            },
            { earlyAccess, invite, referral },
          );
          if (owner === null) return false;
          profileUser.id = owner.id;
          return true;
        },
        async jwt({ token, user: profile }) {
          const userId =
            typeof profile?.id === "string"
              ? profile.id
              : token.identityVersion === AUTHJS_IDENTITY_VERSION &&
                  typeof token.userId === "string"
                ? token.userId
                : null;
          const current = userId === null ? null : await findActiveAuthJsUser(database, userId);
          if (current === null) {
            clearAuthJsIdentity(token);
            return token;
          }
          token.email = current.email;
          token.identityVersion = AUTHJS_IDENTITY_VERSION;
          token.role = current.role;
          token.sub = current.id;
          token.userId = current.id;
          return token;
        },
        async session({ session, token }) {
          const sessionUser: {
            email?: string | null;
            emailVerified?: boolean | Date | null;
            id?: string;
            role?: string;
          } = session.user;
          delete sessionUser.email;
          delete sessionUser.emailVerified;
          delete sessionUser.id;
          delete sessionUser.role;
          const userId =
            token.identityVersion === AUTHJS_IDENTITY_VERSION && typeof token.userId === "string"
              ? token.userId
              : null;
          const current = userId === null ? null : await findActiveAuthJsUser(database, userId);
          if (current !== null) {
            Object.assign(sessionUser, {
              email: current.email,
              emailVerified: current.emailVerified,
              id: current.id,
              role: current.role,
            });
          }
          return session;
        },
      },
      providers: [
        Credentials({
          credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Password", type: "password" },
          },
          async authorize(credentials) {
            const email = credentials?.email;
            const password = credentials?.password;
            if (typeof email !== "string" || typeof password !== "string") {
              return null;
            }
            const normalizedEmail = email.trim().toLowerCase();
            if (!allowCredentialAttempt(normalizedEmail)) return null;
            return verifyCredentials(database, normalizedEmail, password);
          },
        }),
        ...enabledSocialProviders(serverConfig.auth.providers),
      ],
      secret: serverConfig.auth.secret,
      session: { strategy: "jwt" },
      trustHost: true,
    };
  };

  return NextAuth(config);
}

export type AuthJsInstance = ReturnType<typeof createAuthJs>;
