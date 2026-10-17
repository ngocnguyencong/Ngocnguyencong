import { parseServerConfig } from "@supastack/config";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";

import type { MagicLinkMessage } from "./index";
import { createWebAuthWithFactories } from "./server";

describe("real magic-link handler", () => {
  it("emails a verify URL, hashes the stored token, provisions once, and rejects reuse", async () => {
    const origin = "http://localhost:3000";
    const delivered: MagicLinkMessage[] = [];
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
        sendMagicLink: async (message) => {
          delivered.push(message);
        },
        sendVerificationOTP: async () => undefined,
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

    function request(path: string, init?: { body?: unknown; cookie?: string; method?: string }) {
      const method = init?.method ?? (init?.body === undefined ? "GET" : "POST");
      return auth.handler(
        new Request(`${origin}/api/auth/${path}`, {
          method,
          headers: {
            origin,
            "content-type": "application/json",
            ...(init?.cookie ? { cookie: init.cookie } : {}),
          },
          ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        }),
      );
    }

    const email = "magic-owner@example.test";
    expect(
      (
        await request("sign-in/magic-link", {
          body: { email, callbackURL: `${origin}/dashboard` },
        })
      ).status,
    ).toBe(200);
    expect(delivered).toHaveLength(1);
    const message = delivered[0]!;
    expect(message.email).toBe(email);
    expect(message.url).toContain("/magic-link/verify");
    expect(message.url).toContain("token=");
    expect(message.token.length).toBeGreaterThan(16);
    expect(storage.verification).toHaveLength(1);
    const storedIdentifier = String(storage.verification[0]!.identifier);
    expect(
      storedIdentifier === message.token,
      "verification must not persist plaintext token",
    ).toBe(false);

    const verifyUrl = new URL(message.url);
    const token = verifyUrl.searchParams.get("token");
    expect(token).toBe(message.token);

    const signedIn = await request(
      `magic-link/verify?token=${encodeURIComponent(token!)}&callbackURL=${encodeURIComponent(`${origin}/dashboard`)}`,
      { method: "GET" },
    );
    expect(signedIn.status).toBe(302);
    expect(signedIn.headers.get("location")).toBe(`${origin}/dashboard`);
    const cookie = signedIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    expect(cookie.length > 0).toBe(true);
    expect(await (await request("get-session", { cookie })).json()).toMatchObject({
      user: { email, emailVerified: true },
    });
    expect(provision).toHaveBeenCalledTimes(1);

    const reused = await request(
      `magic-link/verify?token=${encodeURIComponent(token!)}&callbackURL=${encodeURIComponent(`${origin}/dashboard`)}`,
      { method: "GET" },
    );
    expect(reused.status).toBe(302);
    expect(reused.headers.get("location")).toMatch(/error=INVALID_TOKEN/i);
    expect(provision).toHaveBeenCalledTimes(1);
  });
});
