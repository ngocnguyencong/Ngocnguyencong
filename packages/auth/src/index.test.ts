import { parseServerConfig } from "@supastack/config";
import { describe, expect, it, vi } from "vitest";

import { createAuthCoreV1Config, createBetterAuthOptions, TrustedOriginError } from "./index.js";

function productionConfig(environment: Record<string, string | undefined> = {}) {
  return parseServerConfig({
    APP_ENV: "production",
    APP_URL: "https://app.example.com",
    AUTH_APPLE_ENABLED: "true",
    APPLE_CLIENT_ID: "apple-client-id",
    APPLE_CLIENT_SECRET: "apple-client-secret",
    AUTH_GOOGLE_ENABLED: "true",
    AUTH_SECRET: "production-auth-secret-at-least-32-characters",
    CREDENTIAL_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    DATABASE_URL: "postgres://supastack:secret@db.example.com:5432/supastack",
    EXPO_PUBLIC_API_URL: "https://api.example.com",
    EXPO_PUBLIC_APP_SCHEME: "com.example.supastack",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    MOBILE_ALLOWED_ORIGINS: "https://app.example.com,https://api.example.com",
    ...environment,
  });
}

describe("createAuthCoreV1Config", () => {
  it("composes password, configured V1 social providers, and exact production origins", () => {
    const options = createAuthCoreV1Config(productionConfig());

    expect(options).toMatchObject({
      baseURL: "https://api.example.com",
      emailAndPassword: { enabled: true },
      socialProviders: {
        apple: { clientId: "apple-client-id", clientSecret: "apple-client-secret" },
        google: { clientId: "google-client-id", clientSecret: "google-client-secret" },
      },
      trustedOrigins: [
        "https://app.example.com",
        "https://api.example.com",
        "com.example.supastack://",
      ],
    });
  });

  it("keeps GitHub, Twitter, and Microsoft typed and honors explicit activation", () => {
    const options = createAuthCoreV1Config(
      productionConfig({
        AUTH_GITHUB_ENABLED: "true",
        AUTH_MICROSOFT_ENABLED: "true",
        AUTH_TWITTER_ENABLED: "true",
        GITHUB_CLIENT_ID: "github-client-id",
        GITHUB_CLIENT_SECRET: "github-client-secret",
        MICROSOFT_CLIENT_ID: "microsoft-client-id",
        MICROSOFT_CLIENT_SECRET: "microsoft-client-secret",
        TWITTER_CLIENT_ID: "twitter-client-id",
        TWITTER_CLIENT_SECRET: "twitter-client-secret",
      }),
    );

    expect(options.socialProviders).toMatchObject({
      github: { clientId: "github-client-id", clientSecret: "github-client-secret" },
      microsoft: { clientId: "microsoft-client-id", clientSecret: "microsoft-client-secret" },
      twitter: { clientId: "twitter-client-id", clientSecret: "twitter-client-secret" },
    });
  });

  it("merges request-aware dynamic origins over the static list", async () => {
    const options = createBetterAuthOptions(
      productionConfig(),
      {
        admitAuthMail: vi.fn(async () => true),
        sendMagicLink: vi.fn(async () => undefined),
        sendVerificationOTP: vi.fn(async () => undefined),
      },
      {
        dynamicTrustedOrigins: async () => ["https://portal.acme.test", null, undefined],
      },
    );

    expect(typeof options.trustedOrigins).toBe("function");
    const resolve = options.trustedOrigins as (request?: Request) => Promise<string[]>;
    const origins = await resolve(undefined);
    expect(origins).toEqual(
      expect.arrayContaining([
        "https://app.example.com",
        "https://api.example.com",
        "com.example.supastack://",
        "https://portal.acme.test",
      ]),
    );
  });

  it("keeps the static trusted origins array when no dynamic provider is given", () => {
    const options = createBetterAuthOptions(productionConfig(), {
      admitAuthMail: vi.fn(async () => true),
      sendMagicLink: vi.fn(async () => undefined),
      sendVerificationOTP: vi.fn(async () => undefined),
    });
    expect(options.trustedOrigins).toEqual([
      "https://app.example.com",
      "https://api.example.com",
      "com.example.supastack://",
    ]);
  });

  it("rejects wildcard trusted origins in production", () => {
    const config = productionConfig();
    const unsafeConfig = {
      ...config,
      mobile: { ...config.mobile, allowedOrigins: ["https://*.example.com"] },
    };

    expect(() => createAuthCoreV1Config(unsafeConfig)).toThrow(TrustedOriginError);
  });

  it("rejects local HTTP trusted origins in production", () => {
    const config = productionConfig();
    const unsafeConfig = {
      ...config,
      mobile: { ...config.mobile, allowedOrigins: ["http://localhost:3000"] },
    };

    expect(() => createAuthCoreV1Config(unsafeConfig)).toThrow(TrustedOriginError);
  });

  it("rejects a production trusted origin with a path", () => {
    const config = productionConfig();
    const unsafeConfig = {
      ...config,
      mobile: { ...config.mobile, allowedOrigins: ["https://app.example.com/callback"] },
    };

    expect(() => createAuthCoreV1Config(unsafeConfig)).toThrow(TrustedOriginError);
  });
});

describe("createBetterAuthOptions", () => {
  it("installs hashed email OTP, magic link, and the Expo server plugin", async () => {
    const sendVerificationOTP = vi.fn(async () => undefined);
    const sendMagicLink = vi.fn(async () => undefined);
    const options = createBetterAuthOptions(productionConfig(), {
      admitAuthMail: vi.fn(async () => true),
      sendMagicLink,
      sendVerificationOTP,
    });
    const plugins = options.plugins as Array<{
      id: string;
      options?: {
        sendMagicLink?: (input: { email: string; token: string; url: string }) => Promise<void>;
        sendVerificationOTP?: (input: {
          email: string;
          otp: string;
          type: "sign-in";
        }) => Promise<void>;
        storeOTP?: string;
        storeToken?: string;
        allowedAttempts?: number;
      };
    }>;
    const emailOtpPlugin = plugins.find((plugin) => plugin.id === "email-otp");
    const magicLinkPlugin = plugins.find((plugin) => plugin.id === "magic-link");

    expect(options.rateLimit?.enabled).toBe(false);
    expect(options.advanced?.ipAddress?.ipAddressHeaders).toEqual(["x-authenticated-client-ip"]);
    expect(emailOtpPlugin?.options?.allowedAttempts).toBe(3);

    expect(options.emailAndPassword).toEqual({
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
    });
    expect(options.account?.accountLinking).toMatchObject({
      allowDifferentEmails: false,
      enabled: true,
      requireLocalEmailVerified: true,
    });
    expect(plugins.map((plugin) => plugin.id)).toEqual([
      "email-otp",
      "magic-link",
      "expo",
      "last-login-method",
      "two-factor",
      "passkey",
      "admin",
    ]);
    expect(emailOtpPlugin?.options?.storeOTP).toBe("hashed");
    expect(magicLinkPlugin?.options?.storeToken).toBe("hashed");

    await emailOtpPlugin?.options?.sendVerificationOTP?.({
      email: "person@example.com",
      otp: "123456",
      type: "sign-in",
    });
    await magicLinkPlugin?.options?.sendMagicLink?.({
      email: "person@example.com",
      token: "token-value",
      url: "https://api.example.com/api/auth/magic-link/verify?token=token-value",
    });

    expect(sendVerificationOTP).toHaveBeenCalledWith({
      email: "person@example.com",
      otp: "123456",
      type: "sign-in",
    });
    expect(sendMagicLink).toHaveBeenCalledWith({
      email: "person@example.com",
      token: "token-value",
      url: "https://api.example.com/api/auth/magic-link/verify?token=token-value",
    });
  });

  it("maps password, email OTP, magic-link verify, and OAuth callback paths to last-used methods", async () => {
    const { resolveLastLoginMethod } = await import("./index.js");
    expect(resolveLastLoginMethod("/sign-in/email")).toBe("email");
    expect(resolveLastLoginMethod("/sign-in/email-otp")).toBe("email-otp");
    expect(resolveLastLoginMethod("/magic-link/verify")).toBe("magic-link");
    expect(resolveLastLoginMethod("/sign-in/magic-link")).toBeNull();
    expect(resolveLastLoginMethod("/callback/github", { id: "github" })).toBe("github");
    expect(resolveLastLoginMethod("/email-otp/reset-password")).toBeNull();
  });

  it("adds the Turnstile captcha plugin only when CAPTCHA_PROVIDER is turnstile", () => {
    const dependencies = {
      admitAuthMail: vi.fn(async () => true),
      sendMagicLink: vi.fn(async () => undefined),
      sendVerificationOTP: vi.fn(async () => undefined),
    };

    const withoutCaptcha = createBetterAuthOptions(productionConfig(), dependencies);
    expect(
      (withoutCaptcha.plugins as Array<{ id: string }>).map((plugin) => plugin.id),
    ).not.toContain("captcha");

    const withCaptcha = createBetterAuthOptions(
      productionConfig({
        CAPTCHA_PROVIDER: "turnstile",
        TURNSTILE_SECRET_KEY: "turnstile-secret",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key",
      }),
      dependencies,
    );
    const captchaPlugin = (withCaptcha.plugins as Array<{ id: string; options?: unknown }>).find(
      (plugin) => plugin.id === "captcha",
    );
    expect(captchaPlugin).toBeDefined();
    expect(captchaPlugin?.options).toMatchObject({
      provider: "cloudflare-turnstile",
      secretKey: "turnstile-secret",
      endpoints: expect.arrayContaining([
        "/sign-in/email",
        "/sign-in/email-otp",
        "/sign-in/magic-link",
        "/email-otp/send-verification-otp",
        "/email-otp/request-password-reset",
        "/forget-password/email-otp",
      ]),
    });
  });

  describe("dynamic trusted origins", () => {
    const dependencies = {
      admitAuthMail: vi.fn(async () => true),
      sendMagicLink: vi.fn(async () => undefined),
      sendVerificationOTP: vi.fn(async () => undefined),
    };

    const staticOrigins = [
      "https://app.example.com",
      "https://api.example.com",
      "com.example.supastack://",
    ];

    async function resolveTrustedOrigins(
      environment: Record<string, string | undefined>,
      dynamicTrustedOrigins: (request?: Request) => Promise<(string | null | undefined)[]>,
    ): Promise<string[]> {
      const options = createBetterAuthOptions(productionConfig(environment), dependencies, {
        dynamicTrustedOrigins,
      });
      const resolve = options.trustedOrigins as (request?: Request) => Promise<string[]>;
      return resolve(undefined);
    }

    it("includes a valid dynamic origin alongside the static list", async () => {
      const origins = await resolveTrustedOrigins({}, async () => ["https://app.customer.com"]);
      expect(origins).toEqual([...staticOrigins, "https://app.customer.com"]);
    });

    it("drops wildcard origins", async () => {
      const origins = await resolveTrustedOrigins({}, async () => [
        "*",
        "https://*.evil.com",
        "https://app.customer.com",
      ]);
      expect(origins).toEqual([...staticOrigins, "https://app.customer.com"]);
    });

    it("drops http:// origins in production but keeps them outside production", async () => {
      const dynamic = async () => ["http://tenant.example.com", "http://localhost:3000"];

      const production = await resolveTrustedOrigins({}, dynamic);
      expect(production).toEqual(staticOrigins);

      const development = await resolveTrustedOrigins({ APP_ENV: "development" }, dynamic);
      expect(development).toEqual([
        ...staticOrigins,
        "http://tenant.example.com",
        "http://localhost:3000",
      ]);
    });

    it("drops origins carrying credentials, a path, a query, or a fragment", async () => {
      const origins = await resolveTrustedOrigins({}, async () => [
        "https://u:p@x.com/",
        "https://x.com/path",
        "https://x.com/?q=1",
        "https://x.com/#frag",
      ]);
      expect(origins).toEqual(staticOrigins);
    });

    it("drops null, undefined, and non-string entries", async () => {
      const origins = await resolveTrustedOrigins({}, async () => [
        null,
        undefined,
        42 as unknown as string,
        "https://app.customer.com",
      ]);
      expect(origins).toEqual([...staticOrigins, "https://app.customer.com"]);
    });

    it("falls back to the static list when the provider rejects", async () => {
      const origins = await resolveTrustedOrigins({}, async () => {
        throw new Error("domain lookup failed");
      });
      expect(origins).toEqual(staticOrigins);
    });

    it("falls back to the static list when the provider throws synchronously", async () => {
      const origins = await resolveTrustedOrigins({}, () => {
        throw new Error("sync lookup failure");
      });
      expect(origins).toEqual(staticOrigins);
    });

    it("falls back to the static list when the provider returns a non-array", async () => {
      const origins = await resolveTrustedOrigins(
        {},
        async () => null as unknown as (string | null | undefined)[],
      );
      expect(origins).toEqual(staticOrigins);
    });

    it("does not duplicate a dynamic origin already in the static list", async () => {
      const origins = await resolveTrustedOrigins({}, async () => [
        "https://app.example.com",
        "https://app.example.com/",
      ]);
      expect(origins).toEqual(staticOrigins);
    });
  });
});
