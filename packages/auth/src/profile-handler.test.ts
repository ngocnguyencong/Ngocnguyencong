import { parseServerConfig } from "@supastack/config";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";
import { createWebAuthWithFactories } from "./server";

describe("real auth profile handler with memory persistence", () => {
  it("persists name changes only for the cookie owner and rejects unauthenticated or foreign-origin writes", async () => {
    const origin = "http://localhost:3000";
    const provision = vi.fn(async () => undefined);
    let deliveredOtp = "";
    const auth = createWebAuthWithFactories(
      {
        database: {},
        admitAuthMail: async () => true,
        provisionPersonalWorkspace: provision,
        sendMagicLink: async () => undefined,
        sendVerificationOTP: async ({ otp }) => {
          deliveredOtp = otp;
        },
        serverConfig: parseServerConfig({ APP_URL: origin, EXPO_PUBLIC_API_URL: origin }),
      },
      {
        createAdapter: () =>
          memoryAdapter({ user: [], session: [], account: [], verification: [] }),
        createAuth: (options) =>
          betterAuth({
            ...options,
            advanced: { ...options.advanced, disableOriginCheck: false, disableCSRFCheck: false },
            logger: { disabled: true },
          }),
      },
    );
    function request(path: string, body?: unknown, cookie?: string, requestOrigin = origin) {
      return auth.handler(
        new Request(`${origin}/api/auth/${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            origin: requestOrigin,
            "content-type": "application/json",
            ...(cookie ? { cookie } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );
    }
    async function signup(email: string, name: string) {
      expect(
        (await request("email-otp/send-verification-otp", { email, type: "sign-in" })).status,
      ).toBe(200);
      const response = await request("sign-in/email-otp", { email, name, otp: deliveredOtp });
      expect(response.status).toBe(200);
      const cookies = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(cookies).toContain("session_token");
      return cookies;
    }
    const first = await signup("first@example.test", "First");
    const second = await signup("second@example.test", "Second");
    expect(provision).toHaveBeenCalledTimes(2);
    expect((await request("update-user", { name: "Changed" }, first)).status).toBe(200);
    const readFirst = await request("get-session", undefined, first);
    expect(await readFirst.json()).toMatchObject({
      user: { name: "Changed", email: "first@example.test" },
    });
    const readSecond = await request("get-session", undefined, second);
    expect(await readSecond.json()).toMatchObject({
      user: { name: "Second", email: "second@example.test" },
    });
    expect((await request("update-user", { name: "Anonymous" })).status).toBe(401);
    expect(
      (await request("update-user", { name: "Foreign" }, first, "https://untrusted.example"))
        .status,
    ).toBe(403);
    expect(await (await request("get-session", undefined, first)).json()).toMatchObject({
      user: { name: "Changed" },
    });
  });
});
