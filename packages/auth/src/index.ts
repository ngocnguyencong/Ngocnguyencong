import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import type { OAuthProviderConfig, ServerConfig } from "@supastack/config";
import type { BetterAuthOptions } from "better-auth";
import { createHmac } from "node:crypto";
import { APIError, createAuthMiddleware, getAuthoritativeSessionFromCtx } from "better-auth/api";
import {
  admin,
  captcha,
  emailOTP,
  lastLoginMethod,
  magicLink,
  twoFactor,
} from "better-auth/plugins";

export * from "./oauth-providers";

const socialProviderNames = ["apple", "github", "google", "microsoft", "twitter"] as const;

type SocialProviderName = (typeof socialProviderNames)[number];

const PASSWORD_LOGIN_ATTEMPT_LIMIT = 3;
const PASSWORD_LOGIN_WINDOW_MS = 10_000;
const PASSWORD_LOGIN_MAX_BUCKETS = 4_096;
const MAILBOX_VERIFIED_ENROLLMENT_PATHS = new Set([
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/two-factor/enable",
]);

function hasAdminRole(role: unknown): boolean {
  return typeof role === "string" && role.split(",").some((entry) => entry.trim() === "admin");
}

function createPasswordLoginAttemptGate(secret: string) {
  const attempts = new Map<string, { count: number; expiresAt: number }>();

  return (email: unknown): boolean => {
    if (typeof email !== "string") return true;
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.length === 0 || normalizedEmail.length > 320) return true;

    const now = Date.now();
    const key = createHmac("sha256", secret).update(normalizedEmail).digest("base64url");
    const current = attempts.get(key);
    if (current && current.expiresAt > now && current.count >= PASSWORD_LOGIN_ATTEMPT_LIMIT) {
      return false;
    }

    if (current && current.expiresAt > now) {
      current.count += 1;
      attempts.delete(key);
      attempts.set(key, current);
    } else {
      attempts.delete(key);
      attempts.set(key, { count: 1, expiresAt: now + PASSWORD_LOGIN_WINDOW_MS });
    }

    for (const [bucketKey, bucket] of attempts) {
      if (bucket.expiresAt <= now) attempts.delete(bucketKey);
    }
    while (attempts.size > PASSWORD_LOGIN_MAX_BUCKETS) {
      const oldestKey = attempts.keys().next().value;
      if (oldestKey === undefined) break;
      attempts.delete(oldestKey);
    }
    return true;
  };
}

export interface EmailOtpMessage {
  email: string;
  otp: string;
  type: "change-email" | "email-verification" | "forget-password" | "sign-in";
}

export interface MagicLinkMessage {
  email: string;
  token: string;
  url: string;
}

export interface AuthCoreDependencies {
  admitAuthMail: (email: string) => Promise<boolean>;
  sendMagicLink: (message: MagicLinkMessage) => Promise<void>;
  sendVerificationOTP: (message: EmailOtpMessage) => Promise<void>;
}

export interface AuthCoreV1Config {
  baseURL: string;
  emailAndPassword: {
    enabled: true;
    disableSignUp: true;
    requireEmailVerification: true;
    revokeSessionsOnPasswordReset: true;
  };
  secret: string;
  socialProviders: Partial<Record<SocialProviderName, { clientId: string; clientSecret: string }>>;
  trustedOrigins: string[];
}

export class TrustedOriginError extends Error {
  constructor(origin: string, reason: string) {
    super(`Unsafe trusted origin "${origin}": ${reason}`);
    this.name = "TrustedOriginError";
  }
}

/**
 * Credential-entry and token-issuing endpoints guarded when a captcha provider
 * is configured. Verification reads the `x-captcha-response` header; consuming
 * endpoints (check-verification-otp, magic-link/verify) stay unlisted — the OTP
 * or token itself is the proof there.
 */
export const CAPTCHA_ENDPOINTS = [
  "/sign-up/email",
  "/sign-in/email",
  "/sign-in/email-otp",
  "/sign-in/magic-link",
  "/email-otp/send-verification-otp",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/request-password-reset",
  "/forget-password",
] as const;

export class OAuthProviderConfigurationError extends Error {
  constructor(provider: SocialProviderName) {
    super(`${provider} requires both a client ID and client secret when enabled.`);
    this.name = "OAuthProviderConfigurationError";
  }
}

function isProduction(config: ServerConfig): boolean {
  return config.app.environment === "production";
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

function toExactWebOrigin(value: string, production: boolean): string {
  if (value.includes("*")) {
    throw new TrustedOriginError(value, "wildcards are not allowed");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TrustedOriginError(value, "it must be an absolute URL");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new TrustedOriginError(value, "it must be an exact HTTP(S) origin");
  }

  if (production && (url.protocol !== "https:" || isLocalHost(url.hostname))) {
    throw new TrustedOriginError(value, "production requires a non-local HTTPS origin");
  }

  return url.origin;
}

function toDeepLinkOrigin(scheme: string): string {
  if (!/^[a-z][a-z0-9+.-]*$/.test(scheme) || scheme === "http" || scheme === "https") {
    throw new TrustedOriginError(scheme, "it must be a non-web URI scheme");
  }

  return `${scheme}://`;
}

function configuredProvider(
  name: SocialProviderName,
  provider: OAuthProviderConfig,
): { clientId: string; clientSecret: string } | undefined {
  if (!provider.enabled) {
    return undefined;
  }

  if (!provider.clientId || !provider.clientSecret) {
    throw new OAuthProviderConfigurationError(name);
  }

  return { clientId: provider.clientId, clientSecret: provider.clientSecret };
}

function configuredSocialProviders(
  providers: ServerConfig["auth"]["providers"],
): AuthCoreV1Config["socialProviders"] {
  const socialProviders: AuthCoreV1Config["socialProviders"] = {};

  for (const name of socialProviderNames) {
    const provider = configuredProvider(name, providers[name]);
    if (provider) {
      socialProviders[name] = provider;
    }
  }

  return socialProviders;
}

/**
 * Produces the policy-owned portion of a Better Auth server configuration.
 * Database-adapter wiring remains in the application composition layer.
 */
export function createAuthCoreV1Config(serverConfig: ServerConfig): AuthCoreV1Config {
  const production = isProduction(serverConfig);
  const baseURL = toExactWebOrigin(serverConfig.app.apiUrl, production);
  const trustedOrigins = [
    toExactWebOrigin(serverConfig.app.webUrl, production),
    ...serverConfig.mobile.allowedOrigins.map((origin) => toExactWebOrigin(origin, production)),
    toDeepLinkOrigin(serverConfig.mobile.scheme),
  ];

  return {
    baseURL,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
    },
    secret: serverConfig.auth.secret,
    socialProviders: configuredSocialProviders(serverConfig.auth.providers),
    trustedOrigins: [...new Set(trustedOrigins)],
  };
}

export function resolveLastLoginMethod(path: string, params?: { id?: string }): string | null {
  if (path.startsWith("/callback/")) {
    return params?.id ?? path.split("/").pop() ?? null;
  }
  if (path === "/sign-in/email" || path === "/sign-up/email") {
    return "email";
  }
  if (path === "/sign-in/email-otp") {
    return "email-otp";
  }
  if (path.startsWith("/magic-link/verify")) {
    return "magic-link";
  }
  return null;
}
export function createBetterAuthOptions(
  serverConfig: ServerConfig,
  dependencies: AuthCoreDependencies,
  extras?: {
    /**
     * Request-aware origin provider merged over the static list (Better Auth
     * 1.7 supports `trustedOrigins` as a function). Used for white-label
     * custom domains whose active hostnames live in the database.
     */
    dynamicTrustedOrigins?: (request?: Request) => Promise<(string | null | undefined)[]>;
  },
): BetterAuthOptions {
  const authCoreConfig = createAuthCoreV1Config(serverConfig);
  const webOrigin = new URL(serverConfig.app.webUrl);
  const dynamicOrigins = extras?.dynamicTrustedOrigins;
  const allowPasswordLoginAttempt = createPasswordLoginAttemptGate(serverConfig.auth.secret);

  return {
    ...authCoreConfig,
    advanced: {
      ipAddress: { ipAddressHeaders: ["x-authenticated-client-ip"] },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const requestBody = ctx.body as Record<string, unknown> | undefined;
        if (ctx.path === "/sign-in/email" && !allowPasswordLoginAttempt(requestBody?.email)) {
          throw new APIError("TOO_MANY_REQUESTS", {
            code: "TOO_MANY_REQUESTS",
            message: "Too many sign-in attempts. Try again later.",
          });
        }
        const recipient =
          ctx.path === "/email-otp/request-email-change"
            ? requestBody?.newEmail
            : requestBody?.email;
        if (
          [
            "/email-otp/send-verification-otp",
            "/sign-in/magic-link",
            "/email-otp/request-password-reset",
            "/forget-password/email-otp",
            "/request-password-reset",
            "/forget-password",
            "/email-otp/request-email-change",
          ].includes(ctx.path ?? "") &&
          typeof recipient === "string" &&
          !(await dependencies.admitAuthMail(recipient))
        ) {
          throw new APIError("TOO_MANY_REQUESTS", {
            code: "AUTH_EMAIL_RATE_LIMITED",
            message: "Too many sign-in messages were requested. Try again later.",
          });
        }
        if (MAILBOX_VERIFIED_ENROLLMENT_PATHS.has(ctx.path ?? "")) {
          const session = await getAuthoritativeSessionFromCtx(ctx);
          if (!session) {
            throw new APIError("UNAUTHORIZED", { code: "UNAUTHORIZED", message: "Unauthorized" });
          }
          if (session.user.emailVerified !== true || session.user.banned === true) {
            throw new APIError("FORBIDDEN", {
              code: "EMAIL_VERIFICATION_REQUIRED",
              message: "Verify your email before adding an authentication method.",
            });
          }
        }
        if (!ctx.path?.startsWith("/admin/")) return;
        const session = await getAuthoritativeSessionFromCtx(ctx);
        if (!session?.user.emailVerified || session.user.banned) {
          throw new APIError("FORBIDDEN", {
            code: "EMAIL_VERIFICATION_REQUIRED",
            message: "Verify your email before accessing platform administration.",
          });
        }
        if (!hasAdminRole(session.user.role)) {
          throw new APIError("FORBIDDEN", {
            code: "ADMIN_ROLE_REQUIRED",
            message: "Platform administration requires an admin account.",
          });
        }
      }),
    },
    trustedOrigins:
      dynamicOrigins === undefined
        ? authCoreConfig.trustedOrigins
        : async (request?: Request) => {
            // Lookup failure — sync throw or rejection — falls back to the
            // static list; a broken provider must never take down auth.
            const provided = await Promise.resolve()
              .then(() => dynamicOrigins(request))
              .catch(() => []);
            const production = isProduction(serverConfig);
            const trusted = new Set(authCoreConfig.trustedOrigins);
            for (const origin of Array.isArray(provided) ? provided : []) {
              if (typeof origin !== "string") {
                continue;
              }
              try {
                // DB-sourced origins get the same exact-origin policy as the
                // static list; invalid entries are dropped, never trusted.
                trusted.add(toExactWebOrigin(origin, production));
              } catch {
                // dropped
              }
            }
            return [...trusted];
          },
    account: {
      // Recovery deletes legacy provider links before mailbox activation.
      updateAccountOnSignIn: true,
      accountLinking: {
        allowDifferentEmails: false,
        enabled: true,
        requireLocalEmailVerified: true,
      },
    },
    // Auth catch-all owns trusted-client admission. Better Auth's native
    // unknown-IP fallback is one shared per-path bucket and lets one anonymous
    // caller block everyone; recipient send caps and OTP attempt counters are
    // enforced independently below/by the mail adapter and OTP plugin.
    rateLimit: { enabled: false },
    plugins: [
      emailOTP({
        allowedAttempts: 3,
        sendVerificationOTP: dependencies.sendVerificationOTP,
        storeOTP: "hashed",
      }),
      magicLink({
        sendMagicLink: async ({ email, token, url }) => {
          await dependencies.sendMagicLink({ email, token, url });
        },
        storeToken: "hashed",
      }),
      expo(),
      lastLoginMethod({
        customResolveMethod: (ctx) => resolveLastLoginMethod(ctx.path ?? "", ctx.params),
      }),
      twoFactor(),
      passkey({
        rpID: webOrigin.hostname,
        rpName: "supastack",
      }),
      admin({ adminRoles: ["admin"], defaultRole: "user" }),
      ...(serverConfig.providers.captcha.kind === "turnstile"
        ? [
            captcha({
              provider: "cloudflare-turnstile",
              secretKey: serverConfig.providers.captcha.secretKey,
              endpoints: [...CAPTCHA_ENDPOINTS],
            }),
          ]
        : []),
    ],
  };
}
