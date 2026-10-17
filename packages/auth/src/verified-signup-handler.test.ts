import { parseServerConfig } from "@supastack/config";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { hashPassword } from "better-auth/crypto";
import { describe, expect, it, vi } from "vitest";

import type { EmailOtpMessage, MagicLinkMessage } from "./index";
import { createAdminBootstrapUserHook, createWebAuthWithFactories } from "./server";

const origin = "http://localhost:3000";
const password = "test-password-strong-123";

function setup(
  admitAuthMail: (email: string) => Promise<boolean> = async () => true,
  overrides: BetterAuthOptions = {},
  serverEnvironment: Record<string, string> = {},
) {
  const delivered: EmailOtpMessage[] = [];
  const magicLinks: MagicLinkMessage[] = [];
  const storage = {
    user: [] as Record<string, unknown>[],
    session: [] as Record<string, unknown>[],
    account: [] as Record<string, unknown>[],
    verification: [] as Record<string, unknown>[],
    twoFactor: [] as Record<string, unknown>[],
    passkey: [] as Record<string, unknown>[],
  };
  const provision = vi.fn(async () => undefined);
  const auth = createWebAuthWithFactories(
    {
      database: storage,
      provisionPersonalWorkspace: provision,
      sendMagicLink: async (message) => {
        magicLinks.push(message);
      },
      sendVerificationOTP: async (message) => {
        delivered.push(message);
      },
      admitAuthMail,
      serverConfig: parseServerConfig({
        APP_URL: origin,
        ADMIN_EMAILS: "root@example.test",
        ...serverEnvironment,
      }),
    },
    {
      createAdapter: () => memoryAdapter(storage),
      createAuth: (options) => betterAuth({ ...options, ...overrides, logger: { disabled: true } }),
    },
  );
  function request(path: string, body?: unknown, cookie?: string, forwardedFor?: string) {
    return auth.handler(
      new Request(`${origin}/api/auth/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          origin,
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
          ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  }
  async function signIn(email: string) {
    expect((await request("email-otp/send-verification-otp", { email, type: "sign-in" })).ok).toBe(
      true,
    );
    const response = await request("sign-in/email-otp", { email, otp: delivered.at(-1)!.otp });
    expect(response.ok).toBe(true);
    return response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  }
  return { auth, delivered, magicLinks, storage, provision, request, signIn };
}

function localGoogleIdTokenProvider(email = "provider-owner@example.test") {
  return {
    google: {
      clientId: "local-oauth-fixture",
      clientSecret: "local-oauth-fixture-secret",
      verifyIdToken: async () => true,
      getUserInfo: async () => ({
        user: {
          id: "legacy-google-subject",
          email,
          emailVerified: true,
          name: "Legacy provider profile",
        },
        data: {
          aud: "local-oauth-fixture",
          azp: "local-oauth-fixture",
          email,
          email_verified: true,
          exp: Math.floor(Date.now() / 1000) + 3600,
          family_name: "Profile",
          given_name: "Legacy",
          iat: Math.floor(Date.now() / 1000),
          iss: "https://accounts.google.com",
          jti: "local-provider-profile",
          name: "Legacy provider profile",
          nbf: Math.floor(Date.now() / 1000),
          picture: "",
          sub: "legacy-google-subject",
        },
      }),
    },
  };
}

describe("verified email signup policy", () => {
  it.each(["email-otp/request-password-reset", "forget-password/email-otp"])(
    "requires configured CAPTCHA before issuing reset mail through %s",
    async (path) => {
      const { auth, delivered, request, storage } = setup(
        undefined,
        {},
        {
          CAPTCHA_PROVIDER: "turnstile",
          TURNSTILE_SECRET_KEY: "local-turnstile-fixture-secret",
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: "local-turnstile-fixture-site",
        },
      );
      const now = new Date();
      storage.user.push({
        id: "reset-owner",
        email: "member@example.test",
        emailVerified: true,
        name: "Member",
        role: "user",
        createdAt: now,
        updatedAt: now,
      });
      const denied = await request(path, { email: "member@example.test" });
      expect(denied.status).toBe(400);
      expect(await denied.json()).toMatchObject({ code: "MISSING_RESPONSE" });
      expect(delivered).toHaveLength(0);
      expect(storage.verification).toHaveLength(0);

      const verify = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(Response.json({ success: true }));
      try {
        const accepted = await auth.handler(
          new Request(`${origin}/api/auth/${path}`, {
            method: "POST",
            headers: {
              origin,
              "content-type": "application/json",
              "x-captcha-response": "local-captcha-proof",
            },
            body: JSON.stringify({ email: "member@example.test" }),
          }),
        );
        expect(accepted.status).toBe(200);
        expect(delivered).toHaveLength(1);
        expect(verify).toHaveBeenCalledTimes(1);
      } finally {
        verify.mockRestore();
      }
    },
  );

  it("denies a cached unverified OAuth callback before recovery can promote its session", async () => {
    const { auth, request, signIn, storage } = setup(async () => true, {
      socialProviders: localGoogleIdTokenProvider(),
    });
    const now = new Date();
    storage.user.push({
      id: "legacy-oauth-owner",
      email: "root@example.test",
      emailVerified: false,
      name: "Legacy",
      role: "user",
      createdAt: now,
      updatedAt: now,
    });
    storage.account.push({
      id: "legacy-oauth-link",
      userId: "legacy-oauth-owner",
      providerId: "google",
      issuer: "https://accounts.google.com",
      accountId: "legacy-google-subject",
      createdAt: now,
      updatedAt: now,
    });
    const context = await auth.$context;
    const createSession = context.internalAdapter.createSession.bind(context.internalAdapter);
    let unblock!: () => void;
    let reached!: () => void;
    const paused = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    let first = true;
    vi.spyOn(context.internalAdapter, "createSession").mockImplementation(async (...args) => {
      if (first) {
        first = false;
        reached();
        await resume;
      }
      return createSession(...args);
    });
    const oauth = request("sign-in/social", {
      provider: "google",
      idToken: { token: "locally-verified-provider-fixture" },
    });
    const reachedSession = await Promise.race([paused.then(() => true), oauth.then(() => false)]);
    // Before the fix, the callback reaches session creation, waits while
    // mailbox recovery deletes existing sessions, then inserts its stale session.
    if (reachedSession) {
      await signIn("root@example.test");
      unblock();
    } else {
      first = false;
      unblock();
      await signIn("root@example.test");
    }
    const response = await oauth;
    expect(response.status, await response.text()).toBe(403);
    expect(response.ok).toBe(false);
    expect(storage.user[0]).toMatchObject({ emailVerified: true, role: "admin" });
    expect(storage.account).toHaveLength(0);
    expect(storage.session).toHaveLength(1);
    // After recovery the stale link is gone. A fresh provider sign-in creates
    // its own identity and cannot create a first password without an email code.
    const providerSignIn = await request("sign-in/social", {
      provider: "google",
      idToken: { token: "locally-verified-provider-fixture" },
    });
    expect(providerSignIn.ok, await providerSignIn.clone().text()).toBe(true);
    const providerCookie = providerSignIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    await auth.api
      .setPassword({
        headers: new Headers({ cookie: providerCookie, origin }),
        body: { newPassword: password },
      })
      .catch(() => undefined);
    const providerOwner = storage.user.find(
      (entry) => entry.email === "provider-owner@example.test",
    );
    expect(providerOwner).toMatchObject({ emailVerified: true, role: "user" });
    expect(storage.account.some((entry) => entry.password)).toBe(false);
    expect(
      (
        await request("sign-in/social", {
          provider: "google",
          idToken: { token: "locally-verified-provider-fixture" },
        })
      ).ok,
    ).toBe(true);
  });
  it("rejects a link-social idToken captured before mailbox recovery revokes its legacy session", async () => {
    const email = "provider-owner@example.test";
    const { auth, request, signIn, storage } = setup(async () => true, {
      socialProviders: localGoogleIdTokenProvider(email),
    });
    const legacyCookie = await signIn(email);
    const owner = storage.user.find((user) => user.email === email);
    expect(owner).toBeDefined();
    owner!.emailVerified = false;
    const ownerId = owner!.id;
    const now = new Date();
    storage.account.push({
      id: "legacy-credential",
      userId: ownerId,
      providerId: "credential",
      accountId: ownerId,
      password: await hashPassword(password),
      createdAt: now,
      updatedAt: now,
    });

    const context = await auth.$context;
    const createAccount = context.internalAdapter.createAccount.bind(context.internalAdapter);
    let unblock!: () => void;
    let reached!: () => void;
    const paused = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    let first = true;
    vi.spyOn(context.internalAdapter, "createAccount").mockImplementation(async (...args) => {
      if (first) {
        first = false;
        reached();
        await resume;
      }
      return createAccount(...args);
    });

    const staleLink = request(
      "link-social",
      { provider: "google", idToken: { token: "locally-verified-provider-fixture" } },
      legacyCookie,
    );
    const reachedCreate = await Promise.race([
      paused.then(() => true),
      staleLink.then(() => false),
    ]);
    if (!reachedCreate) {
      unblock();
      const response = await staleLink;
      throw new Error(`link-social ended before account creation with ${response.status}`);
    }

    await signIn(email);
    unblock();

    const response = await staleLink;
    expect(response.status, await response.clone().text()).toBe(417);
    expect(await response.json()).toMatchObject({ code: "LINKING_FAILED" });
    expect(storage.user.find((user) => user.id === ownerId)).toMatchObject({ emailVerified: true });
    expect(storage.account.some((account) => account.providerId === "credential")).toBe(false);
    expect(storage.account.some((account) => account.providerId === "google")).toBe(false);
  });

  it("allows a verified active session to add a Google idToken account", async () => {
    const email = "provider-owner@example.test";
    const { request, signIn, storage } = setup(async () => true, {
      socialProviders: localGoogleIdTokenProvider(email),
    });
    const cookie = await signIn(email);
    const owner = storage.user.find((user) => user.email === email);

    const response = await request(
      "link-social",
      { provider: "google", idToken: { token: "locally-verified-provider-fixture" } },
      cookie,
    );

    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ status: true, redirect: false });
    expect(storage.account).toContainEqual(
      expect.objectContaining({ providerId: "google", userId: owner!.id }),
    );
  });

  it("rejects a normal OAuth callback link when mailbox recovery revoked its initiating session", async () => {
    const email = "provider-owner@example.test";
    const { auth, request, signIn, storage } = setup(async () => true, {
      socialProviders: localGoogleIdTokenProvider(email),
    });
    const context = await auth.$context;
    const google = context.socialProviders.find((provider) => provider.id === "google");
    expect(google).toBeDefined();
    vi.spyOn(google!, "validateAuthorizationCode").mockResolvedValue({
      accessToken: "local-access-token",
      tokenType: "Bearer",
      scopes: ["openid", "email", "profile"],
    });
    const legacyCookie = await signIn(email);
    const owner = storage.user.find((user) => user.email === email);
    expect(owner).toBeDefined();
    owner!.emailVerified = false;
    const ownerId = owner!.id;
    const now = new Date();
    storage.account.push({
      id: "legacy-credential",
      userId: ownerId,
      providerId: "credential",
      accountId: ownerId,
      password: await hashPassword(password),
      createdAt: now,
      updatedAt: now,
    });

    const start = await request(
      "link-social",
      { provider: "google", callbackURL: `${origin}/after-link`, disableRedirect: true },
      legacyCookie,
    );
    expect(start.ok, await start.clone().text()).toBe(true);
    const authorization = (await start.json()) as { url: string };
    const state = new URL(authorization.url).searchParams.get("state");
    expect(state).toBeTruthy();
    const callbackCookie = [
      legacyCookie,
      ...start.headers.getSetCookie().map((value) => value.split(";")[0]),
    ].join("; ");

    await signIn(email);

    const callback = await request(
      `callback/google?code=local-oauth-code&state=${encodeURIComponent(state!)}`,
      undefined,
      callbackCookie,
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toContain("error=SESSION_REVOKED");
    expect(storage.account.some((account) => account.providerId === "google")).toBe(false);
  });

  it("allows an active verified session to complete the normal OAuth callback link", async () => {
    const email = "provider-owner@example.test";
    const { auth, request, signIn, storage } = setup(async () => true, {
      socialProviders: localGoogleIdTokenProvider(email),
    });
    const context = await auth.$context;
    const google = context.socialProviders.find((provider) => provider.id === "google");
    expect(google).toBeDefined();
    vi.spyOn(google!, "validateAuthorizationCode").mockResolvedValue({
      accessToken: "local-access-token",
      tokenType: "Bearer",
      scopes: ["openid", "email", "profile"],
    });
    const cookie = await signIn(email);
    const owner = storage.user.find((user) => user.email === email);
    const start = await request(
      "link-social",
      { provider: "google", callbackURL: `${origin}/after-link`, disableRedirect: true },
      cookie,
    );
    expect(start.ok, await start.clone().text()).toBe(true);
    const authorization = (await start.json()) as { url: string };
    const state = new URL(authorization.url).searchParams.get("state");
    expect(state).toBeTruthy();
    const callbackCookie = [
      cookie,
      ...start.headers.getSetCookie().map((value) => value.split(";")[0]),
    ].join("; ");

    const callback = await request(
      `callback/google?code=local-oauth-code&state=${encodeURIComponent(state!)}`,
      undefined,
      callbackCookie,
    );

    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe(`${origin}/after-link`);
    expect(storage.account).toContainEqual(
      expect.objectContaining({ providerId: "google", userId: owner!.id }),
    );
  });

  it("rejects direct password signup without creating a user, credential, session or workspace", async () => {
    const { request, storage, provision } = setup();
    const response = await request("sign-up/email", {
      email: "root@example.test",
      name: "Impostor",
      password,
    });
    expect(response.ok).toBe(false);
    expect(storage.user).toHaveLength(0);
    expect(storage.account).toHaveLength(0);
    expect(storage.session).toHaveLength(0);
    expect(provision).not.toHaveBeenCalled();
  });

  it("limits password sign-in attempts per normalized email across client addresses", async () => {
    const { request } = setup();
    for (const [index, email] of [
      "person@example.test",
      "PERSON@example.test",
      "person@example.test",
    ].entries()) {
      await request(
        "sign-in/email",
        { email, password: "wrong-password-123" },
        undefined,
        `198.51.100.${index + 1}`,
      );
    }
    const blocked = await request(
      "sign-in/email",
      { email: " Person@Example.Test ", password: "wrong-password-123" },
      undefined,
      "198.51.100.4",
    );
    expect(blocked.status).toBe(429);
    const otherRecipient = await request(
      "sign-in/email",
      { email: "other@example.test", password: "wrong-password-123" },
      undefined,
      "198.51.100.5",
    );
    expect(otherRecipient.status).not.toBe(429);
  });

  it("rejects the sixth OTP or magic-link send before replacing the last usable code", async () => {
    let admissions = 0;
    const { delivered, magicLinks, request } = setup(async () => {
      admissions += 1;
      return admissions <= 5;
    });
    const email = "mail-quota@example.test";

    for (let index = 0; index < 3; index += 1) {
      expect(
        (await request("email-otp/send-verification-otp", { email, type: "sign-in" })).ok,
      ).toBe(true);
    }
    expect((await request("sign-in/magic-link", { email })).ok).toBe(true);
    expect((await request("email-otp/send-verification-otp", { email, type: "sign-in" })).ok).toBe(
      true,
    );
    const lastOtp = delivered.at(-1)!.otp;

    expect((await request("sign-in/magic-link", { email })).status).toBe(429);
    expect(admissions).toBe(6);
    expect(delivered).toHaveLength(4);
    expect(magicLinks).toHaveLength(1);
    expect((await request("sign-in/email-otp", { email, otp: lastOtp })).ok).toBe(true);
  });

  it.each(["email-otp/request-password-reset", "forget-password/email-otp"])(
    "limits reset mail before code replacement through %s",
    async (path) => {
      let admissions = 0;
      const { storage, delivered, request, signIn } = setup(async () => ++admissions <= 2);
      const email = "reset-quota@example.test";
      await signIn(email);
      expect((await request(path, { email })).ok).toBe(true);
      const resetCode = delivered.at(-1)!.otp;
      expect(delivered.at(-1)!.type).toBe("forget-password");
      expect((await request(path, { email })).status).toBe(429);
      expect(delivered).toHaveLength(2);
      expect(
        (await request("email-otp/reset-password", { email, otp: resetCode, password })).ok,
      ).toBe(true);
      expect(storage.account).toHaveLength(1);
      expect((await request("sign-in/email", { email, password })).ok).toBe(true);
    },
  );

  it("does not grant admin from an unverified allowlisted email", async () => {
    const hook = createAdminBootstrapUserHook(["root@example.test"]);
    expect(await hook({ email: "root@example.test", emailVerified: false })).toBeUndefined();
    expect(await hook({ email: "ROOT@example.test", emailVerified: true })).toMatchObject({
      data: { role: "admin" },
    });
  });

  it("creates the admin identity only after a valid code and then permits password setup", async () => {
    const { request, storage, delivered, auth } = setup();
    const email = "root@example.test";
    await request("email-otp/send-verification-otp", { email, type: "sign-in" });
    expect(storage.user).toHaveLength(0);
    const otp = delivered[0]!.otp;
    expect(
      (await request("sign-in/email-otp", { email, otp: otp === "000000" ? "111111" : "000000" }))
        .ok,
    ).toBe(false);
    expect(storage.user).toHaveLength(0);
    expect(
      storage.verification.some((row) =>
        String(row.identifier).startsWith("email-otp-password-setup:"),
      ),
    ).toBe(false);
    const signedIn = await request("sign-in/email-otp", { email, otp });
    expect(signedIn.ok).toBe(true);
    const cookie = signedIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    expect(await (await request("get-session", undefined, cookie)).json()).toMatchObject({
      user: { emailVerified: true, role: "admin" },
    });
    expect(storage.account).toHaveLength(0);
    await auth.api.setPassword({
      headers: new Headers({ cookie, origin }),
      body: { newPassword: password },
    });
    expect(storage.account).toHaveLength(1);
    expect(storage.account[0]!.password).not.toBe(password);
    expect((await request("sign-in/email", { email, password })).ok).toBe(true);
  });

  it("requires the same email-code sign-in session for first password creation", async () => {
    const { auth, signIn, request, magicLinks, storage } = setup();
    const email = "otp-session@example.test";
    const otpCookie = await signIn(email);
    const otpSession = storage.session.at(-1);
    const passwordSetupProof = storage.verification.find((row) =>
      String(row.identifier).startsWith("email-otp-password-setup:"),
    );
    expect(otpSession).toBeDefined();
    expect(passwordSetupProof?.identifier).toBe(
      `email-otp-password-setup:${String(otpSession?.id)}`,
    );

    expect((await request("sign-in/magic-link", { email })).ok).toBe(true);
    const magic = magicLinks.at(-1);
    expect(magic).toBeDefined();
    const token = new URL(magic!.url).searchParams.get("token");
    expect(token).toBe(magic!.token);
    const magicResponse = await request(`magic-link/verify?token=${encodeURIComponent(token!)}`);
    expect(magicResponse.ok).toBe(true);
    const magicCookie = magicResponse.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");

    await auth.api
      .setPassword({
        headers: new Headers({ cookie: magicCookie, origin }),
        body: { newPassword: password },
      })
      .catch(() => undefined);
    expect(storage.account).toHaveLength(0);

    await auth.api.setPassword({
      headers: new Headers({ cookie: otpCookie, origin }),
      body: { newPassword: password },
    });
    expect(storage.account).toHaveLength(1);
    expect(
      storage.verification.some((row) => row.identifier === passwordSetupProof?.identifier),
    ).toBe(false);

    storage.account.splice(0);
    await auth.api
      .setPassword({
        headers: new Headers({ cookie: otpCookie, origin }),
        body: { newPassword: "another-strong-password-456" },
      })
      .catch(() => undefined);
    expect(storage.account).toHaveLength(0);
  });

  it("rejects a legacy unverified session at both password setup and the admin API", async () => {
    const { auth, signIn, request, storage } = setup();
    const cookie = await signIn("root@example.test");
    storage.user[0]!.emailVerified = false;
    await expect(
      auth.api.setPassword({
        headers: new Headers({ cookie, origin }),
        body: { newPassword: password },
      }),
    ).rejects.toThrow();
    expect(storage.account).toHaveLength(0);
    expect((await request("admin/list-users")).ok).toBe(false);
    expect((await request("admin/list-users?limit=10", undefined, cookie)).status).toBe(403);
  });

  it("does not allow an expired email-code proof to create a first password", async () => {
    const { auth, signIn, storage } = setup();
    const cookie = await signIn("expired-proof@example.test");
    const proof = storage.verification.find((row) =>
      String(row.identifier).startsWith("email-otp-password-setup:"),
    );
    expect(proof).toBeDefined();
    proof!.expiresAt = new Date(Date.now() - 1_000);

    await auth.api
      .setPassword({
        headers: new Headers({ cookie, origin }),
        body: { newPassword: password },
      })
      .catch(() => undefined);
    expect(storage.account).toHaveLength(0);
  });

  it("promotes an existing pending allowlisted account only after email-code verification", async () => {
    const { storage, signIn, request } = setup();
    storage.user.push({
      id: "pending-root",
      email: "root@example.test",
      name: "Root",
      emailVerified: false,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const cookie = await signIn("root@example.test");
    expect(await (await request("get-session", undefined, cookie)).json()).toMatchObject({
      user: { id: "pending-root", emailVerified: true, role: "admin" },
    });
  });

  it("OTP sign-in removes a legacy unverified password and revokes its existing sessions", async () => {
    const { auth, storage, signIn, request } = setup();
    const email = "legacy-otp@example.test";
    const oldPassword = "attacker-controlled-password-123";
    const now = new Date();
    storage.user.push({
      id: "legacy-otp-user",
      email,
      name: "Legacy",
      emailVerified: false,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });
    storage.account.push({
      id: "legacy-otp-account",
      accountId: "legacy-otp-user",
      providerId: "credential",
      userId: "legacy-otp-user",
      password: await hashPassword(oldPassword),
      createdAt: now,
      updatedAt: now,
    });
    storage.session.push({
      id: "legacy-otp-session",
      token: "attacker-otp-session-token",
      userId: "legacy-otp-user",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });

    const otpCookie = await signIn(email);
    expect(storage.account.some((row) => row.userId === "legacy-otp-user")).toBe(false);
    expect(storage.session.some((row) => row.token === "attacker-otp-session-token")).toBe(false);
    const cookieName = otpCookie.split(";")[0]!.split("=")[0]!;
    expect(
      await (
        await request("get-session", undefined, `${cookieName}=attacker-otp-session-token`)
      ).json(),
    ).toBeNull();
    expect((await request("sign-in/email", { email, password: oldPassword })).ok).toBe(false);

    await auth.api.setPassword({
      headers: new Headers({ cookie: otpCookie, origin }),
      body: { newPassword: password },
    });
    expect((await request("sign-in/email", { email, password: oldPassword })).ok).toBe(false);
    expect((await request("sign-in/email", { email, password })).ok).toBe(true);
  });

  it("email-code verification removes pre-verification credentials and sessions before promotion", async () => {
    const { delivered, request, storage } = setup();
    const email = "root@example.test";
    const oldPassword = "attacker-controlled-password-987";
    const now = new Date();
    storage.user.push({
      id: "legacy-verified-email-user",
      email,
      name: "Legacy Root",
      emailVerified: false,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });
    storage.account.push({
      id: "legacy-verified-email-account",
      accountId: "legacy-verified-email-user",
      issuer: "local:credential",
      providerId: "credential",
      userId: "legacy-verified-email-user",
      password: await hashPassword(oldPassword),
      createdAt: now,
      updatedAt: now,
    });
    storage.session.push({
      id: "legacy-verified-email-session",
      token: "attacker-email-verification-session-token",
      userId: "legacy-verified-email-user",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });

    expect(
      (await request("email-otp/send-verification-otp", { email, type: "email-verification" })).ok,
    ).toBe(true);
    const response = await request("email-otp/verify-email", { email, otp: delivered.at(-1)!.otp });
    expect(response.ok).toBe(true);
    expect(storage.user[0]).toMatchObject({ emailVerified: true, role: "admin" });
    expect(storage.account.some((row) => row.userId === "legacy-verified-email-user")).toBe(false);
    expect(
      storage.session.some((row) => row.token === "attacker-email-verification-session-token"),
    ).toBe(false);
    expect((await request("sign-in/email", { email, password: oldPassword })).ok).toBe(false);
  });

  it("magic-link recovery also removes a legacy password and does not grant code-only password setup", async () => {
    const { auth, storage, request, magicLinks, signIn } = setup();
    const email = "legacy-magic@example.test";
    const oldPassword = "attacker-controlled-password-456";
    const now = new Date();
    storage.user.push({
      id: "legacy-magic-user",
      email,
      name: "Legacy",
      emailVerified: false,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });
    storage.account.push({
      id: "legacy-magic-account",
      accountId: "legacy-magic-user",
      providerId: "credential",
      userId: "legacy-magic-user",
      password: await hashPassword(oldPassword),
      createdAt: now,
      updatedAt: now,
    });
    storage.session.push({
      id: "legacy-magic-session",
      token: "attacker-magic-session-token",
      userId: "legacy-magic-user",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    storage.user[0]!.twoFactorEnabled = true;
    storage.twoFactor.push({
      id: "legacy-magic-two-factor",
      userId: "legacy-magic-user",
      secret: "attacker-enrolled-secret",
      backupCodes: "[]",
      verified: true,
      createdAt: now,
      updatedAt: now,
    });
    storage.passkey.push({
      id: "legacy-magic-passkey",
      userId: "legacy-magic-user",
      credentialID: "attacker-credential",
      publicKey: "attacker-public-key",
      createdAt: now,
    });

    expect((await request("sign-in/magic-link", { email })).ok).toBe(true);
    const link = magicLinks.at(-1)!;
    const token = new URL(link.url).searchParams.get("token")!;
    const verified = await request(`magic-link/verify?token=${encodeURIComponent(token)}`);
    expect(verified.ok).toBe(true);
    const magicCookie = verified.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    expect(storage.account.some((row) => row.userId === "legacy-magic-user")).toBe(false);
    expect(storage.session.some((row) => row.token === "attacker-magic-session-token")).toBe(false);
    expect(storage.user[0]!.twoFactorEnabled).toBe(false);
    expect(storage.twoFactor).toHaveLength(0);
    expect(storage.passkey).toHaveLength(0);
    expect((await request("sign-in/email", { email, password: oldPassword })).ok).toBe(false);
    await expect(
      auth.api.setPassword({
        headers: new Headers({ cookie: magicCookie, origin }),
        body: { newPassword: password },
      }),
    ).rejects.toThrow();
    expect(storage.account).toHaveLength(0);

    const otpCookie = await signIn(email);
    await auth.api.setPassword({
      headers: new Headers({ cookie: otpCookie, origin }),
      body: { newPassword: password },
    });
    expect((await request("sign-in/email", { email, password: oldPassword })).ok).toBe(false);
    expect((await request("sign-in/email", { email, password })).ok).toBe(true);
  });

  it("rejects an expired signup code before creating any identity or password", async () => {
    const { request, delivered, storage } = setup();
    const email = "expired@example.test";
    await request("email-otp/send-verification-otp", { email, type: "sign-in" });
    storage.verification[0]!.expiresAt = new Date("2000-01-01T00:00:00.000Z");
    expect((await request("sign-in/email-otp", { email, otp: delivered[0]!.otp })).ok).toBe(false);
    expect(storage.user).toHaveLength(0);
    expect(storage.account).toHaveLength(0);
    expect(storage.session).toHaveLength(0);
  });

  it("allows a password reset only after consuming the email-bound reset code", async () => {
    const { storage, request, delivered } = setup();
    const email = "pending@example.test";
    const oldPassword = "attacker-controlled-password-789";
    const oldHash = await hashPassword(oldPassword);
    const now = new Date();
    storage.user.push({
      id: "pending",
      email,
      name: "Pending",
      emailVerified: false,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    storage.account.push({
      id: "pending-credential",
      accountId: "pending",
      providerId: "credential",
      issuer: "local:credential",
      userId: "pending",
      password: oldHash,
      createdAt: now,
      updatedAt: now,
    });
    storage.session.push({
      id: "pending-attacker-session",
      token: "pending-attacker-session-token",
      userId: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    await request("email-otp/request-password-reset", { email });
    const otp = delivered.at(-1)!.otp;
    expect(
      (
        await request("email-otp/reset-password", {
          email,
          otp: otp === "000000" ? "111111" : "000000",
          password,
        })
      ).ok,
    ).toBe(false);
    expect(storage.account).toHaveLength(1);
    expect(storage.account[0]!.password).toBe(oldHash);
    expect((await request("email-otp/reset-password", { email, otp, password })).ok).toBe(true);
    expect(storage.user[0]!.emailVerified).toBe(true);
    expect(storage.account).toHaveLength(1);
    expect(storage.account[0]!.password).not.toBe(oldHash);
    expect(storage.session.some((row) => row.token === "pending-attacker-session-token")).toBe(
      false,
    );
    expect((await request("email-otp/reset-password", { email, otp, password })).ok).toBe(false);
    expect((await request("sign-in/email", { email, password: oldPassword })).ok).toBe(false);
    expect((await request("sign-in/email", { email, password })).ok).toBe(true);
  });

  it("blocks password login and password updates for a legacy unverified identity", async () => {
    const { storage, signIn, request, auth } = setup();
    const email = "legacy@example.test";
    const cookie = await signIn(email);
    await auth.api.setPassword({
      headers: new Headers({ origin, cookie }),
      body: { newPassword: password },
    });
    storage.user[0]!.emailVerified = false;
    expect((await request("sign-in/email", { email, password })).ok).toBe(false);
    const oldHash = storage.account[0]!.password;
    expect(
      (
        await request(
          "change-password",
          { currentPassword: password, newPassword: "another-strong-password-456" },
          cookie,
        )
      ).ok,
    ).toBe(false);
    expect(storage.account[0]!.password).toBe(oldHash);
  });
});
