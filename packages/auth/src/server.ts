import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createPersonalWorkspaceRecords, workspace, workspaceMembership } from "@supastack/db";
import * as schema from "@supastack/db/schema";
import type { ServerConfig } from "@supastack/config";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError, getAuthoritativeSessionFromCtx } from "better-auth/api";

import { createBetterAuthOptions, type EmailOtpMessage, type MagicLinkMessage } from "./index";

export interface AuthUser {
  id: string;
  name?: string | null;
}

export type EarlyAccessCodeStatus = "valid" | "unknown" | "expired" | "redeemed" | "email-mismatch";

/**
 * Injectable early-access seam. The web app owns the cookie names (written by
 * its proxy for `?invite=`/`?ref=`), the sanitizer, and the DB-backed code
 * validation/redemption; this package owns the gate policy: only `create-user`
 * actions are gated, `admin`-method creations and configured admin emails
 * always pass, and the gate exists only while `earlyAccess.inviteOnly` is on.
 */
export interface EarlyAccessHooks {
  cookies: { invite: string; referral: string };
  sanitize: (value: string | null | undefined) => string | null;
  validateCode: (input: { code: string; email: string }) => Promise<EarlyAccessCodeStatus>;
  onCreated?: (input: {
    user: AuthUser & { email: string };
    invite: string | null;
    referral: string | null;
  }) => Promise<void>;
}

/** Minimal cookie-reading surface shared by better-auth endpoint contexts. */
interface CookieContext {
  getCookie?: (key: string) => string | null;
}

function readCtxCode(
  context: CookieContext | null | undefined,
  name: string,
  sanitize: EarlyAccessHooks["sanitize"],
): string | null {
  return sanitize(context?.getCookie?.(name) ?? null);
}

const INVITE_REJECT_DESCRIPTIONS: Record<Exclude<EarlyAccessCodeStatus, "valid">, string> = {
  unknown: "Sign-up currently requires an early-access invite code.",
  expired: "This early-access invite has expired.",
  redeemed: "This early-access invite has already been used.",
  "email-mismatch": "This early-access invite is reserved for a different email address.",
};

/**
 * Invite-only signup gate for `user.validateUserInfo`. Runs only on
 * `create-user` actions; admin-plugin creations (`method === "admin"`), and
 * emails in the configured admin list bypass so bootstrap never deadlocks.
 */
export function createEarlyAccessGate(options: {
  adminEmails: readonly string[];
  inviteCookie: string;
  sanitize: EarlyAccessHooks["sanitize"];
  validateCode: EarlyAccessHooks["validateCode"];
}) {
  const adminSet = new Set(options.adminEmails.map((email) => email.toLowerCase()));

  return async (
    data: {
      user: { email?: string; emailVerified?: boolean };
      source: { action: string; method: string };
    },
    context?: CookieContext | null,
  ): Promise<{ error: string; errorDescription?: string } | void> => {
    if (data.source.action !== "create-user" || data.source.method === "admin") {
      return;
    }
    const email = (data.user.email ?? "").trim().toLowerCase();
    if (adminSet.has(email)) {
      return;
    }
    if (data.user.emailVerified !== true) {
      return {
        error: "invite_required",
        errorDescription: "Verify your email before using an early-access invite.",
      };
    }
    const code = readCtxCode(context, options.inviteCookie, options.sanitize);
    if (!code) {
      return {
        error: "invite_required",
        errorDescription: INVITE_REJECT_DESCRIPTIONS.unknown,
      };
    }
    const status = await options.validateCode({ code, email });
    if (status !== "valid") {
      return { error: "invite_required", errorDescription: INVITE_REJECT_DESCRIPTIONS[status] };
    }
  };
}

export interface PersonalWorkspaceDatabaseExecutor {
  insert(table: typeof workspace | typeof workspaceMembership): {
    values(record: Record<string, unknown>): {
      onConflictDoNothing(options?: { target?: unknown }): Promise<unknown>;
    };
  };
}

export interface PersonalWorkspaceDatabase extends PersonalWorkspaceDatabaseExecutor {
  transaction<T>(run: (transaction: PersonalWorkspaceDatabaseExecutor) => Promise<T>): Promise<T>;
}

export interface WebAuthCompositionInput {
  admitAuthMail: (email: string) => Promise<boolean>;
  database: unknown;
  /** Request-aware trusted origins (e.g. active white-label domains). */
  dynamicTrustedOrigins?: (request?: Request) => Promise<(string | null | undefined)[]>;
  provisionPersonalWorkspace: (user: AuthUser) => Promise<void>;
  /** Revokes app-owned API credentials before a legacy unverified row activates. */
  revokeUserApiKeys?: (userId: string) => Promise<void>;
  sendMagicLink: (message: MagicLinkMessage) => Promise<void>;
  sendVerificationOTP: (message: EmailOtpMessage) => Promise<void>;
  serverConfig: ServerConfig;
  earlyAccess?: EarlyAccessHooks;
}

type AuthOptions = BetterAuthOptions & Record<string, unknown>;

function hasAdminRole(role: unknown): boolean {
  return typeof role === "string" && role.split(",").some((entry) => entry.trim() === "admin");
}

type AuthHookRecord = Record<string, unknown>;
type MailboxOwner = Readonly<{
  banned?: boolean;
  email: string;
  emailVerified: boolean;
  id?: string;
  role?: string;
}>;
const OTP_PASSWORD_SETUP_PREFIX = "email-otp-password-setup:";
const OTP_PASSWORD_SETUP_TTL_MS = 15 * 60 * 1000;

function recordOf(value: unknown): AuthHookRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AuthHookRecord)
    : null;
}

function stringField(record: AuthHookRecord | null, field: string): string | undefined {
  const value = record?.[field];
  return typeof value === "string" ? value : undefined;
}

function mailboxOwner(value: unknown): MailboxOwner | null {
  let record = recordOf(value);
  const nestedUser = recordOf(record?.user);
  if (nestedUser !== null) record = nestedUser;
  const email = stringField(record, "email");
  const id = stringField(record, "id");
  const role = stringField(record, "role");
  return email === undefined
    ? null
    : {
        ...(typeof record?.banned === "boolean" ? { banned: record.banned } : {}),
        email,
        emailVerified: record?.emailVerified === true,
        ...(id === undefined ? {} : { id }),
        ...(role === undefined ? {} : { role }),
      };
}

function hookContextParts(value: unknown) {
  const outer = recordOf(value);
  const inner = recordOf(outer?.context);
  const session = recordOf(inner?.session);
  const sessionUser = recordOf(session?.user);
  const sessionData = recordOf(session?.session);
  return {
    adapter: recordOf(inner?.internalAdapter),
    body: recordOf(outer?.body),
    databaseAdapter: recordOf(inner?.adapter),
    path: stringField(outer, "path"),
    sessionId: stringField(sessionData, "id") ?? stringField(session, "id"),
    sessionUserId: stringField(sessionUser, "id"),
  };
}

type PromotionWhere = { field: string; value: string };

function promotionWhere(value: unknown): PromotionWhere | null {
  if (!Array.isArray(value)) return null;
  const clauses = value.map(recordOf).filter((entry): entry is AuthHookRecord => entry !== null);
  const clause =
    clauses.find((entry) => entry.field === "id") ??
    clauses.find((entry) => entry.field === "email");
  return clause && typeof clause.value === "string"
    ? { field: String(clause.field), value: clause.value }
    : null;
}

/**
 * Better Auth's mailbox-proof plugins invoke updateUser(id, {emailVerified:true})
 * after their account/session cleanup. The database hook projection contains
 * no id for magic-link callbacks, so enforce factor cleanup at the adapter
 * boundary where the actual update predicate is available. Adapter factories
 * and transaction callbacks are wrapped so Drizzle and Firestore follow the
 * same path.
 */
function wrapMailboxPromotionAdapter(
  adapterValue: unknown,
  revokeUserApiKeys?: (userId: string) => Promise<void>,
): unknown {
  const wrapInstance = (candidate: unknown): unknown => {
    if ((typeof candidate !== "object" || candidate === null) && typeof candidate !== "function")
      return candidate;

    return new Proxy(candidate, {
      get(target, property, receiver) {
        const value: unknown = Reflect.get(target, property, receiver);
        if (property === "update" && typeof value === "function") {
          return async (input: unknown) => {
            const updateArgs = recordOf(input);
            const update = recordOf(updateArgs?.update);
            if (updateArgs?.model === "user" && update?.emailVerified === true) {
              const predicate = promotionWhere(updateArgs.where);
              const findOne: unknown = Reflect.get(target, "findOne", target);
              const deleteMany: unknown = Reflect.get(target, "deleteMany", target);
              if (!predicate || typeof findOne !== "function" || typeof deleteMany !== "function") {
                throw new Error(
                  "Cannot verify legacy authentication state before mailbox activation.",
                );
              }
              const existing: unknown = await Reflect.apply(findOne, target, [
                { model: "user", where: [predicate] },
              ]);
              const owner = recordOf(existing);
              if (owner !== null && owner.emailVerified !== true) {
                const userId = stringField(owner, "id");
                if (!userId) {
                  throw new Error("Cannot identify legacy user before mailbox activation.");
                }
                await Reflect.apply(deleteMany, target, [
                  { model: "passkey", where: [{ field: "userId", value: userId }] },
                ]);
                await Reflect.apply(deleteMany, target, [
                  { model: "twoFactor", where: [{ field: "userId", value: userId }] },
                ]);
                await revokeUserApiKeys?.(userId);
                return Reflect.apply(value, target, [
                  {
                    ...updateArgs,
                    update: { ...update, twoFactorEnabled: false },
                  },
                ]) as unknown;
              }
            }
            return Reflect.apply(value, target, [input]) as unknown;
          };
        }
        if (property === "transaction" && typeof value === "function") {
          return (callback: unknown, ...args: unknown[]) => {
            if (typeof callback !== "function") {
              return Reflect.apply(value, target, [callback, ...args]) as unknown;
            }
            return Reflect.apply(value, target, [
              (transactionAdapter: unknown, ...callbackArgs: unknown[]) =>
                Reflect.apply(callback, undefined, [
                  wrapInstance(transactionAdapter),
                  ...callbackArgs,
                ]) as unknown,
              ...args,
            ]) as unknown;
          };
        }
        return typeof value === "function" ? (value.bind(target) as unknown) : value;
      },
    });
  };

  if (typeof adapterValue === "function") {
    return new Proxy(adapterValue, {
      apply(target, thisArg, argumentsList) {
        return wrapInstance(Reflect.apply(target, thisArg, argumentsList));
      },
    });
  }
  return wrapInstance(adapterValue);
}

async function issueEmailOtpPasswordSetupProof(
  sessionValue: unknown,
  context: unknown,
): Promise<void> {
  const { adapter, path } = hookContextParts(context);
  if (path !== "/sign-in/email-otp") return;
  const session = recordOf(sessionValue);
  const sessionId = stringField(session, "id");
  const userId = stringField(session, "userId");
  const create = adapter?.createVerificationValue;
  if (!sessionId || !userId || typeof create !== "function") return;
  await (
    create as (value: { identifier: string; value: string; expiresAt: Date }) => Promise<unknown>
  ).call(adapter, {
    identifier: `${OTP_PASSWORD_SETUP_PREFIX}${sessionId}`,
    value: userId,
    expiresAt: new Date(Date.now() + OTP_PASSWORD_SETUP_TTL_MS),
  });
}

/** Reread identity before its session so activation cannot revive a revoked request. */
async function requireCurrentEnrollmentSession(
  context: unknown,
  userId: string | undefined,
): Promise<void> {
  const { databaseAdapter, sessionId, sessionUserId } = hookContextParts(context);
  const owner = userId ? await callAdapterLookup(context, "findUserById", userId) : null;
  if (!owner || owner.emailVerified !== true || owner.banned === true) {
    throw new APIError("FORBIDDEN", {
      code: "EMAIL_VERIFICATION_REQUIRED",
      message: "Verify your email before adding an authentication method.",
    });
  }
  const findOne = databaseAdapter?.findOne;
  if (!sessionId || sessionUserId !== userId || typeof findOne !== "function") {
    throw new APIError("FORBIDDEN", {
      code: "SESSION_REVOKED",
      message: "Sign in again before adding an authentication method.",
    });
  }
  const result: unknown = await (
    findOne as (query: {
      model: string;
      where: Array<{ field: string; value: string }>;
    }) => Promise<unknown>
  ).call(databaseAdapter, {
    model: "session",
    where: [
      { field: "id", value: sessionId },
      { field: "userId", value: userId! },
    ],
  });
  const persisted = recordOf(result);
  const expiresAt = persisted?.expiresAt;
  if (
    persisted?.id !== sessionId ||
    persisted.userId !== userId ||
    !(expiresAt instanceof Date || typeof expiresAt === "string") ||
    new Date(expiresAt).getTime() <= Date.now() ||
    !Number.isFinite(new Date(expiresAt).getTime())
  ) {
    throw new APIError("FORBIDDEN", {
      code: "SESSION_REVOKED",
      message: "Sign in again before adding an authentication method.",
    });
  }
}

async function requireCurrentLinkedAccountSession(
  account: unknown,
  context: unknown,
): Promise<void> {
  const { path, sessionUserId } = hookContextParts(context);
  const record = recordOf(account);
  if (record?.providerId === "credential" || (path !== "/link-social" && !sessionUserId)) return;
  await requireCurrentEnrollmentSession(context, stringField(record, "userId"));
}

async function requireCurrentAuthenticatorOwner(
  sessionValue: unknown,
  context: unknown,
): Promise<void> {
  const { body, databaseAdapter, path, sessionId } = hookContextParts(context);
  const isTwoFactor = path?.startsWith("/two-factor/verify-") === true;
  if (path !== "/passkey/verify-authentication" && !isTwoFactor) return;
  const userId = stringField(recordOf(sessionValue), "userId");
  if (isTwoFactor && sessionId) await requireCurrentEnrollmentSession(context, userId);
  const response = recordOf(body?.response);
  const credentialID = stringField(response, "id");
  const owner = userId ? await callAdapterLookup(context, "findUserById", userId) : null;
  if (!owner || owner.emailVerified !== true || owner.banned === true) {
    throw new APIError("FORBIDDEN", {
      code: "EMAIL_VERIFICATION_REQUIRED",
      message: "Verify your email before using this authentication method.",
    });
  }
  const findOne = databaseAdapter?.findOne;
  if (!userId || (!isTwoFactor && !credentialID) || typeof findOne !== "function") {
    throw new APIError("FORBIDDEN", {
      code: isTwoFactor ? "TWO_FACTOR_NOT_FOUND" : "PASSKEY_NOT_FOUND",
      message: "The authentication method is no longer available for this account.",
    });
  }
  const passkeyRow: unknown = await (
    findOne as (query: {
      model: string;
      where: Array<{ field: string; value: string }>;
    }) => Promise<unknown>
  ).call(databaseAdapter, {
    model: isTwoFactor ? "twoFactor" : "passkey",
    where: [
      ...(!isTwoFactor ? [{ field: "credentialID", value: credentialID! }] : []),
      { field: "userId", value: userId },
    ],
  });
  const persisted = recordOf(passkeyRow);
  if (
    persisted?.userId !== userId ||
    (isTwoFactor ? !stringField(persisted, "id") : persisted.credentialID !== credentialID)
  ) {
    throw new APIError("FORBIDDEN", {
      code: isTwoFactor ? "TWO_FACTOR_NOT_FOUND" : "PASSKEY_NOT_FOUND",
      message: "The authentication method is no longer available for this account.",
    });
  }
}

async function consumeEmailOtpPasswordSetupProof(
  context: unknown,
  userId: string,
): Promise<boolean> {
  const { adapter, sessionId, sessionUserId } = hookContextParts(context);
  const consume = adapter?.consumeVerificationValue;
  if (!sessionId || sessionUserId !== userId || typeof consume !== "function") return false;
  const proof: unknown = await (consume as (identifier: string) => Promise<unknown>).call(
    adapter,
    `${OTP_PASSWORD_SETUP_PREFIX}${sessionId}`,
  );
  const record = recordOf(proof);
  const expiresAt = record?.expiresAt;
  const expiry = expiresAt instanceof Date ? expiresAt.getTime() : Number.NaN;
  return record?.value === userId && expiry > Date.now();
}

async function callAdapterLookup(
  context: unknown,
  methodName: "findUserByEmail" | "findUserById",
  value: string,
): Promise<MailboxOwner | null> {
  const { adapter } = hookContextParts(context);
  const method = adapter?.[methodName];
  if (typeof method !== "function") return null;
  const result: unknown = await (method as (input: string) => Promise<unknown>).call(
    adapter,
    value,
  );
  return mailboxOwner(result);
}

async function revokeUnprovenAccountAccessBeforeEmailVerification(
  userValue: unknown,
  context: unknown,
): Promise<boolean> {
  const changedUser = recordOf(userValue);
  if (changedUser?.emailVerified !== true) return true;
  const { body, path } = hookContextParts(context);
  // A provider callback can update `emailVerified` for an already-linked
  // account without carrying a target user in the database-hook projection.
  // Only mailbox-code/token endpoints may promote an unverified local row.
  const isMailboxProofPath =
    path === "/email-otp/verify-email" ||
    path === "/email-otp/reset-password" ||
    path === "/sign-in/email-otp" ||
    path?.startsWith("/magic-link/verify") === true;
  if (!isMailboxProofPath) return false;
  // Better Auth 1.7.2's magic-link verifier consumes the one-use token,
  // resolves the owner from that token, and calls revokeUnprovenAccountAccess
  // (which removes every account and session) before its id-only
  // updateUser(id, { emailVerified: true }) call reaches this hook.
  if (path === "/magic-link/verify" && !stringField(changedUser, "id")) return true;
  const suppliedUserId = stringField(changedUser, "id") ?? stringField(body, "userId");
  const suppliedEmail = stringField(changedUser, "email") ?? stringField(body, "email");
  const existing = suppliedUserId
    ? await callAdapterLookup(context, "findUserById", suppliedUserId)
    : suppliedEmail
      ? await callAdapterLookup(context, "findUserByEmail", suppliedEmail.trim().toLowerCase())
      : null;
  if (existing === null) return false;
  if (existing.emailVerified) return true;
  const userId = suppliedUserId ?? existing.id;
  if (!userId) return false;

  const { adapter } = hookContextParts(context);
  const findAccounts = adapter?.findAccounts;
  const deleteAccount = adapter?.deleteAccount;
  const deleteUserSessions = adapter?.deleteUserSessions;
  if (
    typeof findAccounts !== "function" ||
    typeof deleteAccount !== "function" ||
    typeof deleteUserSessions !== "function"
  )
    return false;

  const accounts: unknown = await (findAccounts as (id: string) => Promise<unknown>).call(
    adapter,
    userId,
  );
  if (!Array.isArray(accounts)) return false;
  const accountRows = accounts.map((value) => {
    const account = recordOf(value);
    return account === null
      ? null
      : { id: stringField(account, "id"), providerId: stringField(account, "providerId") };
  });
  if (accountRows.some((account) => account === null || !account.id || !account.providerId))
    return false;
  const isVerifiedPasswordReset = path === "/email-otp/reset-password";
  for (const account of accountRows) {
    if (isVerifiedPasswordReset && account!.providerId === "credential") continue;
    await (deleteAccount as (id: string) => Promise<unknown>).call(adapter, account!.id!);
  }
  await (deleteUserSessions as (id: string) => Promise<unknown>).call(adapter, userId);
  return true;
}

async function promoteAdminRole(context: unknown, userId: string): Promise<void> {
  const { adapter } = hookContextParts(context);
  const update = adapter?.updateUser;
  if (typeof update !== "function") return;
  await (update as (id: string, changes: { role: string }) => Promise<unknown>).call(
    adapter,
    userId,
    { role: "admin" },
  );
}

export interface WebAuthFactories<Auth> {
  createAdapter: (database: unknown) => unknown;
  createAuth: (options: AuthOptions) => Auth;
}

/**
 * Creates Better Auth options through injectable factories so tests need no
 * database connection, OAuth application, or mail provider.
 */
export function createWebAuthWithFactories<Auth>(
  input: WebAuthCompositionInput,
  factories: WebAuthFactories<Auth>,
): Auth {
  const earlyAccess = input.earlyAccess;
  const inviteOnly = input.serverConfig.earlyAccess.inviteOnly;

  const options: AuthOptions = {
    ...createBetterAuthOptions(
      input.serverConfig,
      {
        admitAuthMail: input.admitAuthMail,
        sendMagicLink: input.sendMagicLink,
        sendVerificationOTP: input.sendVerificationOTP,
      },
      input.dynamicTrustedOrigins === undefined
        ? undefined
        : { dynamicTrustedOrigins: input.dynamicTrustedOrigins },
    ),
    database: wrapMailboxPromotionAdapter(
      factories.createAdapter(input.database),
      input.revokeUserApiKeys,
    ),
    databaseHooks: {
      session: {
        create: {
          before: async (session, context) => requireCurrentAuthenticatorOwner(session, context),
          after: async (session, context) => issueEmailOtpPasswordSetupProof(session, context),
        },
      },
      user: {
        create: {
          after: async (
            user: AuthUser & { email: string; emailVerified?: boolean },
            context: CookieContext | null,
          ) => {
            // Never provision workspace membership or consume growth codes
            // before the mailbox proof that makes a signup eligible.
            if (user.emailVerified !== true) return;
            await input.provisionPersonalWorkspace({
              id: user.id,
              ...(user.name === undefined ? {} : { name: user.name }),
            });
            if (earlyAccess?.onCreated) {
              await earlyAccess.onCreated({
                user: {
                  id: user.id,
                  email: user.email,
                  ...(user.name === undefined ? {} : { name: user.name }),
                },
                invite: readCtxCode(context, earlyAccess.cookies.invite, earlyAccess.sanitize),
                referral: readCtxCode(context, earlyAccess.cookies.referral, earlyAccess.sanitize),
              });
            }
          },
          ...(input.serverConfig.admin.emails.length > 0
            ? { before: createAdminBootstrapUserHook(input.serverConfig.admin.emails) }
            : {}),
        },
        update: {
          before: async (user, context) => {
            const { path, sessionUserId } = hookContextParts(context);
            if (
              recordOf(user)?.twoFactorEnabled === true &&
              path?.startsWith("/two-factor/verify-")
            ) {
              await requireCurrentEnrollmentSession(context, sessionUserId);
            }
            return (await revokeUnprovenAccountAccessBeforeEmailVerification(user, context))
              ? undefined
              : false;
          },
          after: async (user, context) => {
            if (user.emailVerified !== true || !context) return;
            const { body } = hookContextParts(context);
            const userId = stringField(recordOf(user), "id") ?? stringField(body, "userId");
            const email = stringField(recordOf(user), "email") ?? stringField(body, "email");
            const owner = userId
              ? await callAdapterLookup(context, "findUserById", userId)
              : email
                ? await callAdapterLookup(context, "findUserByEmail", email.trim().toLowerCase())
                : null;
            if (owner?.id && owner.emailVerified && owner.banned !== true) {
              // Unverified create-user rows did not receive side effects from
              // the create hook. Ensure a mailbox-verified user gets their
              // stable personal workspace on the proof-update path.
              const name = stringField(recordOf(user), "name");
              await input.provisionPersonalWorkspace({
                id: owner.id,
                ...(name === undefined ? {} : { name }),
              });
            }
            if (
              owner?.id &&
              owner.emailVerified &&
              owner.banned !== true &&
              input.serverConfig.admin.emails.some(
                (adminEmail) => adminEmail.toLowerCase() === owner.email.toLowerCase(),
              ) &&
              !hasAdminRole(owner.role)
            )
              await promoteAdminRole(context, owner.id);
          },
        },
      },
      account: {
        create: {
          before: async (account, context) => {
            await requireCurrentLinkedAccountSession(account, context);
            if (typeof account.password === "string" && account.password.length > 0) {
              await requirePasswordMailboxProof(account.userId, context);
            }
          },
        },
        update: {
          before: async (account, context) => {
            if (typeof account.password !== "string" || account.password.length === 0) return;
            const { body, sessionUserId } = hookContextParts(context);
            const bodyUserId = stringField(body, "userId");
            const targetId =
              (typeof account.userId === "string" ? account.userId : undefined) ??
              bodyUserId ??
              sessionUserId;
            const owner = targetId;
            await requirePasswordMailboxProof(owner, context);
          },
        },
      },
    },
    user: {
      validateUserInfo: async (data, context) => {
        if (data.source.method === "oauth" && data.source.action === "link-account") {
          const currentSession = await getAuthoritativeSessionFromCtx(context);
          if (currentSession?.user.id !== data.user.id) {
            return {
              error: "SESSION_REVOKED",
              errorDescription: "Sign in again before linking an account.",
            };
          }
        }
        if (data.source.method === "oauth" && data.source.action !== "create-user") {
          const owner = await callAdapterLookup(context, "findUserById", data.user.id ?? "");
          if (owner?.emailVerified !== true || owner.banned === true) {
            return {
              error: "EMAIL_VERIFICATION_REQUIRED",
              errorDescription: "Verify your email before using a linked account.",
            };
          }
        }
        if (inviteOnly) {
          if (!earlyAccess) {
            const email = (data.user.email ?? "").trim().toLowerCase();
            if (
              data.source.action === "create-user" &&
              data.source.method !== "admin" &&
              !input.serverConfig.admin.emails.some(
                (adminEmail) => adminEmail.toLowerCase() === email,
              )
            ) {
              return {
                error: "invite_required",
                errorDescription: INVITE_REJECT_DESCRIPTIONS.unknown,
              };
            }
            return;
          }
          return createEarlyAccessGate({
            adminEmails: input.serverConfig.admin.emails,
            inviteCookie: earlyAccess.cookies.invite,
            sanitize: earlyAccess.sanitize,
            validateCode: earlyAccess.validateCode,
          })(data, context);
        }
      },
    },
  };

  return factories.createAuth(options);
}

/**
 * Bootstraps platform admins: users whose email appears in the validated
 * server-only ADMIN_EMAILS list and a verified mailbox receive the `admin` role. Emails are
 * normalized to lowercase at parse time; matching here is case-insensitive.
 */
export function createAdminBootstrapUserHook(adminEmails: readonly string[]) {
  const adminSet = new Set(adminEmails.map((email) => email.toLowerCase()));

  return async <T extends { banned?: boolean; email: string; emailVerified?: boolean }>(
    user: T,
  ) => {
    if (
      user.emailVerified === true &&
      user.banned !== true &&
      adminSet.has(user.email.toLowerCase())
    ) {
      return { data: { ...user, role: "admin" } };
    }
    return undefined;
  };
}

async function requirePasswordMailboxProof(
  userId: string | undefined,
  context: unknown,
): Promise<void> {
  const { body, path } = hookContextParts(context);
  const resetEmail = stringField(body, "email");
  const owner = userId
    ? await callAdapterLookup(context, "findUserById", userId)
    : resetEmail === undefined
      ? null
      : await callAdapterLookup(context, "findUserByEmail", resetEmail.toLowerCase());
  // This endpoint consumes and validates the email-bound OTP before invoking
  // account hooks. It marks a legacy user's email verified after the write.
  const verifiedResetCode =
    path === "/email-otp/reset-password" &&
    resetEmail !== undefined &&
    owner?.email.toLowerCase() === resetEmail.toLowerCase();
  if (verifiedResetCode) return;
  if (
    (path === "/set-password" || path === "virtual:") &&
    userId !== undefined &&
    owner?.emailVerified === true &&
    (await consumeEmailOtpPasswordSetupProof(context, userId))
  )
    return;
  if (owner?.emailVerified === true && (path === "/change-password" || path === "/reset-password"))
    return;
  throw new APIError("FORBIDDEN", {
    code: "EMAIL_VERIFICATION_REQUIRED",
    message: "Verify your email before setting a password.",
  });
}

/** Creates a production Better Auth server over the repository's Drizzle schema. */
export function createWebAuth(input: WebAuthCompositionInput) {
  return createWebAuthWithFactories(input, {
    createAdapter: (database) =>
      drizzleAdapter(database as never, { provider: "pg", schema }) as unknown,
    createAuth: (options) => betterAuth(options as never),
  });
}

export interface PersonalWorkspaceProvisioningDependencies {
  now?: () => Date;
}

/**
 * Uses stable primary keys and the existing membership unique index so retries
 * cannot create another personal workspace or owner membership for a user.
 */
export function createDrizzlePersonalWorkspaceProvisioner(
  database: PersonalWorkspaceDatabase,
  dependencies: PersonalWorkspaceProvisioningDependencies = {},
): (user: AuthUser) => Promise<void> {
  const now = dependencies.now ?? (() => new Date());

  return async (user) => {
    const records = createPersonalWorkspaceRecords({
      createId: (kind) => `${kind}_${user.id}`,
      now,
      userId: user.id,
      ...(user.name === undefined ? {} : { userName: user.name }),
    });

    await database.transaction(async (transaction) => {
      await transaction
        .insert(workspace)
        .values(records.workspace)
        .onConflictDoNothing({ target: workspace.id });
      await transaction
        .insert(workspaceMembership)
        .values(records.membership)
        .onConflictDoNothing({
          target: [workspaceMembership.workspaceId, workspaceMembership.userId],
        });
    });
  };
}
