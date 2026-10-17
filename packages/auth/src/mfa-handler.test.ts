import { parseServerConfig } from "@supastack/config";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";

import { createWebAuthWithFactories } from "./server";

function secretFromTotpUri(totpURI: string): string {
  const encoded = new URL(totpURI).searchParams.get("secret");
  if (!encoded) {
    throw new Error("totpURI missing secret");
  }
  return new TextDecoder().decode(base32.decode(encoded));
}

describe("real MFA handler with memory persistence", () => {
  it("cannot finish a cached pending TOTP enrollment after mailbox recovery revoked its session", async () => {
    const origin = "http://localhost:3000";
    let deliveredOtp = "";
    const storage = {
      user: [] as Record<string, unknown>[],
      session: [] as Record<string, unknown>[],
      account: [] as Record<string, unknown>[],
      verification: [] as Record<string, unknown>[],
      twoFactor: [] as Record<string, unknown>[],
      passkey: [] as Record<string, unknown>[],
    };
    const auth = createWebAuthWithFactories(
      {
        database: storage,
        admitAuthMail: async () => true,
        provisionPersonalWorkspace: async () => undefined,
        sendVerificationOTP: async ({ otp }) => {
          deliveredOtp = otp;
        },
        sendMagicLink: async () => undefined,
        serverConfig: parseServerConfig({ APP_URL: origin, EXPO_PUBLIC_API_URL: origin }),
      },
      {
        createAdapter: () => memoryAdapter(storage),
        createAuth: (options) => betterAuth({ ...options, logger: { disabled: true } }),
      },
    );
    const request = (path: string, body: unknown, cookie = "") =>
      auth.handler(
        new Request(`${origin}/api/auth/${path}`, {
          method: "POST",
          headers: { origin, "content-type": "application/json", cookie },
          body: JSON.stringify(body),
        }),
      );
    const email = "pending-factor@example.test";
    const password = "test-password-strong-123";
    const signIn = async () => {
      expect(
        (await request("email-otp/send-verification-otp", { email, type: "sign-in" })).ok,
      ).toBe(true);
      const response = await request("sign-in/email-otp", { email, otp: deliveredOtp });
      expect(response.ok).toBe(true);
      return response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
    };
    const oldCookie = await signIn();
    await auth.api.setPassword({
      headers: new Headers({ cookie: oldCookie, origin }),
      body: { newPassword: password },
    });
    const enabled = await request("two-factor/enable", { password, method: "totp" }, oldCookie);
    expect(enabled.ok).toBe(true);
    const { totpURI } = (await enabled.json()) as { totpURI: string };
    const code = await createOTP(secretFromTotpUri(totpURI), { digits: 6, period: 30 }).totp();
    expect(storage.twoFactor[0]?.verified).toBe(false);
    storage.user[0]!.emailVerified = false;

    const context = await auth.$context;
    const updateUser = context.internalAdapter.updateUser.bind(context.internalAdapter);
    let reached!: () => void;
    let unblock!: () => void;
    const paused = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    vi.spyOn(context.internalAdapter, "updateUser").mockImplementation(async (...args) => {
      if (args[1].twoFactorEnabled === true) {
        reached();
        await resume;
      }
      return updateUser(...args);
    });
    const verification = request("two-factor/verify-totp", { code }, oldCookie);
    try {
      expect(await Promise.race([paused.then(() => true), verification.then(() => false)])).toBe(
        true,
      );
      // Real mailbox proof deletes the captured session and pending factor.
      await signIn();
      expect(storage.twoFactor).toHaveLength(0);
      expect(storage.session).toHaveLength(1);
    } finally {
      unblock();
    }
    const response = await verification;
    expect(response.status, await response.clone().text()).toBe(403);
    expect(storage.user[0]).toMatchObject({ emailVerified: true, twoFactorEnabled: false });
    expect(storage.twoFactor).toHaveLength(0);
    expect(storage.session).toHaveLength(1);
  });
  it("enables TOTP, verifies a computed code, rejects a wrong code, and exposes passkey options without device WebAuthn", async () => {
    const origin = "http://localhost:3000";
    let deliveredOtp = "";
    const storage = {
      user: [] as Record<string, unknown>[],
      session: [] as Record<string, unknown>[],
      account: [] as Record<string, unknown>[],
      verification: [] as Record<string, unknown>[],
      twoFactor: [] as Record<string, unknown>[],
      passkey: [] as Record<string, unknown>[],
    };
    const auth = createWebAuthWithFactories(
      {
        database: storage,
        admitAuthMail: async () => true,
        provisionPersonalWorkspace: vi.fn(async () => undefined),
        sendVerificationOTP: async ({ otp }) => {
          deliveredOtp = otp;
        },
        sendMagicLink: async () => undefined,
        serverConfig: parseServerConfig({ APP_URL: origin, EXPO_PUBLIC_API_URL: origin }),
      },
      {
        createAdapter: () => memoryAdapter(storage),
        createAuth: (options) =>
          betterAuth({
            ...options,
            advanced: { ...options.advanced, disableOriginCheck: false, disableCSRFCheck: false },
            logger: { disabled: true },
          }),
      },
    );

    function request(path: string, body?: unknown, cookie?: string) {
      return auth.handler(
        new Request(`${origin}/api/auth/${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            origin,
            "content-type": "application/json",
            ...(cookie ? { cookie } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );
    }

    const email = "mfa-owner@example.test";
    const password = "test-password-strong-123";
    expect(
      (await request("email-otp/send-verification-otp", { email, type: "sign-in" })).status,
    ).toBe(200);
    const signedUp = await request("sign-in/email-otp", {
      email,
      name: "MFA Owner",
      otp: deliveredOtp,
    });
    expect(signedUp.status).toBe(200);
    const cookie = signedUp.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    expect(cookie).toContain("session_token");
    await auth.api.setPassword({
      headers: new Headers({ cookie, origin }),
      body: { newPassword: password },
    });

    const enabled = await request("two-factor/enable", { password, method: "totp" }, cookie);
    expect(enabled.status).toBe(200);
    const enabledBody = (await enabled.json()) as {
      method: string;
      totpURI: string;
      backupCodes: string[];
    };
    expect(enabledBody.method).toBe("totp");
    expect(enabledBody.totpURI).toContain("otpauth://");
    expect(enabledBody.backupCodes.length).toBeGreaterThan(0);
    expect(storage.twoFactor).toHaveLength(1);

    expect(storage.twoFactor[0]?.verified).toBe(false);

    const secret = secretFromTotpUri(enabledBody.totpURI);
    const wrong = await request("two-factor/verify-totp", { code: "000000" }, cookie);
    expect(wrong.ok).toBe(false);

    const code = await createOTP(secret, { digits: 6, period: 30 }).totp();
    const verified = await request("two-factor/verify-totp", { code }, cookie);
    expect(verified.status).toBe(200);
    const verifiedBody = (await verified.json()) as {
      token?: string;
      user?: { twoFactorEnabled?: boolean };
    };
    expect(typeof verifiedBody.token).toBe("string");
    expect(storage.twoFactor[0]?.verified).toBe(true);

    const verifiedCookieParts = verified.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .filter(Boolean);
    const sessionCookie =
      [
        ...verifiedCookieParts,
        ...cookie.split("; ").filter((part) => !part.startsWith("session_token=")),
      ]
        .filter(Boolean)
        .join("; ") || cookie;
    const sessionAfter = await (await request("get-session", undefined, sessionCookie)).json();
    expect(sessionAfter).toMatchObject({ user: { email, twoFactorEnabled: true } });
    expect(storage.user.some((row) => row.twoFactorEnabled === true)).toBe(true);

    const anonymousPasskey = await request("passkey/generate-register-options");
    expect(anonymousPasskey.status).toBe(401);

    const optionsResponse = await request(
      "passkey/generate-register-options",
      undefined,
      sessionCookie,
    );
    expect(optionsResponse.status).toBe(200);
    const options = (await optionsResponse.json()) as {
      challenge: string;
      rp: { id: string; name: string };
    };
    expect(options.challenge.length).toBeGreaterThan(8);
    expect(options.rp.id).toBe("localhost");
    expect(options.rp.name).toBe("supastack");

    const badVerify = await request(
      "passkey/verify-registration",
      {
        name: "soft-fake",
        response: {
          id: "not-a-real-credential",
          rawId: "not-a-real-credential",
          type: "public-key",
          response: {
            clientDataJSON: "e30=",
            attestationObject: "e30=",
          },
        },
      },
      sessionCookie,
    );
    expect(badVerify.ok).toBe(false);
    expect(storage.passkey).toHaveLength(0);

    storage.user.find((row) => row.email === email)!.emailVerified = false;
    const blockedTotpEnrollment = await request(
      "two-factor/enable",
      { password, method: "totp" },
      sessionCookie,
    );
    const blockedPasskeyOptions = await request(
      "passkey/generate-register-options",
      undefined,
      sessionCookie,
    );
    expect([401, 403]).toContain(blockedTotpEnrollment.status);
    expect([401, 403]).toContain(blockedPasskeyOptions.status);
    expect(storage.twoFactor).toHaveLength(1);
    expect(storage.passkey).toHaveLength(0);
  });
});
