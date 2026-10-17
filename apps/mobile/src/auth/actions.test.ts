import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const loadActions = () => import("./actions");

test("uses Better Auth's Email OTP endpoints for the sign-in flow", async () => {
  const calls: Array<{ method: string; payload?: unknown }> = [];
  const success = { data: { ok: true }, error: null };
  const { createMobileAuthActions } = await loadActions();
  const actions = createMobileAuthActions({
    emailOtp: {
      sendVerificationOtp: async (payload) => {
        calls.push({ method: "emailOtp.sendVerificationOtp", payload });
        return success;
      },
    },
    getSession: async () => success,
    signIn: {
      emailOtp: async (payload) => {
        calls.push({ method: "signIn.emailOtp", payload });
        return success;
      },
      social: async () => success,
    },
    signOut: async () => success,
  });

  await expect(actions.requestEmailOtp("person@example.com")).resolves.toBe(success);
  await expect(actions.verifyEmailOtp("person@example.com", "123456")).resolves.toBe(success);

  expect(calls).toEqual([
    {
      method: "emailOtp.sendVerificationOtp",
      payload: { email: "person@example.com", type: "sign-in" },
    },
    {
      method: "signIn.emailOtp",
      payload: { email: "person@example.com", otp: "123456" },
    },
  ]);
});

test.each([undefined, "com.example.app"])(
  "uses the approved native callback for Google and Apple with scheme %j",
  async (scheme) => {
    vi.stubEnv("EXPO_PUBLIC_APP_SCHEME", scheme);
    vi.resetModules();
    const callbackURL = `${scheme ?? "supastack"}://auth/callback`;
    const calls: Array<{ method: string; payload: unknown }> = [];
    const success = { data: { ok: true }, error: null };
    const { createMobileAuthActions } = await loadActions();
    const actions = createMobileAuthActions({
      emailOtp: { sendVerificationOtp: async () => success },
      getSession: async () => success,
      signIn: {
        emailOtp: async () => success,
        social: async (payload) => {
          calls.push({ method: "signIn.social", payload });
          return success;
        },
      },
      signOut: async () => success,
    });

    await actions.signInWithGoogle();
    await actions.signInWithApple();

    expect(calls).toEqual([
      {
        method: "signIn.social",
        payload: { callbackURL, provider: "google" },
      },
      {
        method: "signIn.social",
        payload: { callbackURL, provider: "apple" },
      },
    ]);
  },
);

test("keeps session lifecycle inside Better Auth", async () => {
  const calls: Array<{ method: string; payload?: unknown }> = [];
  const success = { data: { session: { id: "session-1" } }, error: null };
  const { createMobileAuthActions } = await loadActions();
  const actions = createMobileAuthActions({
    emailOtp: { sendVerificationOtp: async () => success },
    getSession: async () => {
      calls.push({ method: "getSession" });
      return success;
    },
    signIn: {
      emailOtp: async () => success,
      social: async () => success,
    },
    signOut: async () => {
      calls.push({ method: "signOut" });
      return success;
    },
  });

  await expect(actions.restoreSession()).resolves.toBe(success);
  await expect(actions.signOut()).resolves.toBe(success);

  expect(calls).toEqual([{ method: "getSession" }, { method: "signOut" }]);
});

test("refuses a social callback outside the production deep-link policy", async () => {
  const { createMobileAuthActions } = await loadActions();

  expect(() =>
    createMobileAuthActions(
      {
        emailOtp: { sendVerificationOtp: async () => ({ data: null, error: null }) },
        getSession: async () => ({ data: null, error: null }),
        signIn: {
          emailOtp: async () => ({ data: null, error: null }),
          social: async () => ({ data: null, error: null }),
        },
        signOut: async () => ({ data: null, error: null }),
      },
      "https://app.supastack.example.com.evil.test/auth/callback",
    ),
  ).toThrow("approved production deep-link origin");
});
