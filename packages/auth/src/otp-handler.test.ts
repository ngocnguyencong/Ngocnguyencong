import { parseServerConfig } from "@supastack/config";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";
import type { EmailOtpMessage } from "./index";
import { createWebAuthWithFactories } from "./server";

describe("real Email OTP handler", () => {
  it("hashes codes, rejects incorrect or cross-email use, consumes once and revokes signed-out sessions", async () => {
    const origin = "http://localhost:3000";
    const delivered: EmailOtpMessage[] = [];
    const storage = {
      user: [] as Record<string, unknown>[],
      session: [] as Record<string, unknown>[],
      account: [] as Record<string, unknown>[],
      verification: [] as Record<string, unknown>[],
    };
    const provision = vi.fn(async () => undefined);
    const auth = createWebAuthWithFactories(
      {
        database: storage,
        admitAuthMail: async () => true,
        provisionPersonalWorkspace: provision,
        sendVerificationOTP: async (message) => {
          delivered.push(message);
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
          headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );
    }
    const email = "otp-owner@example.test";
    expect(
      (await request("email-otp/send-verification-otp", { email, type: "sign-in" })).status,
    ).toBe(200);
    expect(delivered).toHaveLength(1);
    const message = delivered[0]!;
    expect(message.email).toBe(email);
    expect(message.type).toBe("sign-in");
    const signInVerification = storage.verification.find(
      (record) => record.identifier === `sign-in-otp-${email}`,
    );
    expect(signInVerification).toBeDefined();
    const storedValue = String(signInVerification!.value);
    expect(
      storedValue.split(":")[0] === message.otp,
      "verification must not persist plaintext code",
    ).toBe(false);
    const wrongCode = message.otp === "000000" ? "111111" : "000000";
    const wrong = await request("sign-in/email-otp", { email, otp: wrongCode });
    expect(wrong.ok).toBe(false);
    expect(storage.session).toHaveLength(0);
    expect(provision).not.toHaveBeenCalled();
    expect(
      (await request("sign-in/email-otp", { email: "another@example.test", otp: message.otp })).ok,
    ).toBe(false);
    const signedIn = await request("sign-in/email-otp", { email, otp: message.otp });
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    expect(cookie.length > 0).toBe(true);
    expect(await (await request("get-session", undefined, cookie)).json()).toMatchObject({
      user: { email, emailVerified: true },
    });
    expect(provision).toHaveBeenCalledTimes(1);
    expect((await request("sign-in/email-otp", { email, otp: message.otp })).ok).toBe(false);
    expect(provision).toHaveBeenCalledTimes(1);
    expect((await request("sign-out", {}, cookie)).status).toBe(200);
    expect(await (await request("get-session", undefined, cookie)).json()).toBeNull();
    expect((await request("update-user", { name: "Revoked" }, cookie)).status).toBe(401);
    expect(
      (await request("email-otp/send-verification-otp", { email, type: "sign-in" })).status,
    ).toBe(200);
    expect(delivered).toHaveLength(2);
    const refreshedSignInVerification = storage.verification.find(
      (record) => record.identifier === `sign-in-otp-${email}`,
    );
    expect(refreshedSignInVerification).toBeDefined();
    refreshedSignInVerification!.expiresAt = new Date("2000-01-01T00:00:00.000Z");
    expect((await request("sign-in/email-otp", { email, otp: delivered[1]!.otp })).ok).toBe(false);
    expect(storage.session).toHaveLength(0);
    expect(provision).toHaveBeenCalledTimes(1);
  });
});
