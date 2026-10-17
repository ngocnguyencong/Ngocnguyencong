import { describe, expect, it } from "vitest";

import { createWebAuthActions } from "./web-auth-actions.js";

const success = { data: { ok: true }, error: null };

function createClient(calls: Array<{ method: string; payload?: unknown; options?: unknown }>) {
  return {
    emailOtp: {
      async sendVerificationOtp(payload: unknown, options?: unknown) {
        calls.push({ method: "emailOtp.sendVerificationOtp", payload, options });
        return success;
      },
    },
    async getSession() {
      calls.push({ method: "getSession" });
      return success;
    },
    signIn: {
      async emailOtp(payload: unknown, options?: unknown) {
        calls.push({ method: "signIn.emailOtp", payload, options });
        return success;
      },
      async magicLink(payload: unknown, options?: unknown) {
        calls.push({ method: "signIn.magicLink", payload, options });
        return success;
      },
      async social(payload: unknown, options?: unknown) {
        calls.push({ method: "signIn.social", payload, options });
        return success;
      },
    },
    async signOut() {
      calls.push({ method: "signOut" });
      return success;
    },
  };
}

describe("real web auth actions", () => {
  it("delegates OTP, session, and sign-out to Better Auth", async () => {
    const calls: Array<{ method: string; payload?: unknown }> = [];
    const actions = createWebAuthActions(createClient(calls), {
      callbackURL: "/auth",
      providers: { apple: false, github: false, google: false, microsoft: false, twitter: false },
    });

    await actions.requestEmailOtp("person@example.com");
    await actions.verifyEmailOtp("person@example.com", "123456");
    await actions.restoreSession();
    await actions.signOut();

    expect(calls).toEqual([
      {
        method: "emailOtp.sendVerificationOtp",
        payload: { email: "person@example.com", type: "sign-in" },
      },
      {
        method: "signIn.emailOtp",
        payload: { email: "person@example.com", otp: "123456" },
      },
      { method: "getSession" },
      { method: "signOut" },
    ]);
  });

  it("offers and invokes only social providers enabled by server-projected flags", async () => {
    const calls: Array<{ method: string; payload?: unknown }> = [];
    const actions = createWebAuthActions(createClient(calls), {
      callbackURL: "/auth",
      providers: {
        apple: false,
        github: true,
        google: true,
        microsoft: false,
        twitter: false,
      },
    });

    expect(actions.enabledSocialProviders).toEqual(["google", "github"]);
    await actions.signInWithSocial("google");
    await expect(actions.signInWithSocial("apple")).rejects.toThrow(
      "Apple sign-in is not configured.",
    );
    expect(calls).toEqual([
      {
        method: "signIn.social",
        payload: { callbackURL: "/auth", provider: "google" },
      },
    ]);
  });

  it("attaches the captcha token as x-captcha-response only when one exists", async () => {
    const calls: Array<{ method: string; payload?: unknown; options?: unknown }> = [];
    let token: string | null = "turnstile-token-1";
    const actions = createWebAuthActions(createClient(calls), {
      callbackURL: "/auth",
      getCaptchaToken: () => token,
      providers: {
        apple: false,
        github: false,
        google: false,
        microsoft: false,
        twitter: false,
      },
    });

    await actions.requestEmailOtp("person@example.com");
    expect(calls[0]?.options).toEqual({
      headers: { "x-captcha-response": "turnstile-token-1" },
    });

    token = null;
    await actions.verifyEmailOtp("person@example.com", "123456");
    expect(calls[1]?.options).toBeUndefined();
  });

  it("surfaces the last-used login method from the client plugin", () => {
    const actions = createWebAuthActions(
      {
        ...createClient([]),
        getLastUsedLoginMethod: () => "google",
      },
      {
        callbackURL: "/auth",
        providers: {
          apple: false,
          github: false,
          google: true,
          microsoft: false,
          twitter: false,
        },
      },
    );

    expect(actions.lastUsedMethod()).toBe("google");
    expect(actions.isLastUsedMethod("google")).toBe(true);
    expect(actions.isLastUsedMethod("magic-link")).toBe(false);
  });

  it("requests a magic-link email through Better Auth", async () => {
    const calls: Array<{ method: string; payload?: unknown }> = [];
    const actions = createWebAuthActions(createClient(calls), {
      callbackURL: "/dashboard",
      providers: {
        apple: false,
        github: false,
        google: false,
        microsoft: false,
        twitter: false,
      },
    });

    await actions.requestMagicLink("person@example.com");

    expect(calls).toEqual([
      {
        method: "signIn.magicLink",
        payload: { email: "person@example.com", callbackURL: "/dashboard" },
      },
    ]);
  });
});
