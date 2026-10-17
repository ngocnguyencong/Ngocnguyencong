import { getDictionary } from "@supastack/i18n";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  session: { data: null, error: null, isPending: false } as {
    data: null | { user: { email: string; id: string; name: string } };
    error: unknown;
    isPending: boolean;
  },
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("./web-auth-client", () => ({
  createWebAuthClient: () => ({
    __stubClient: true,
    useSession: () => harness.session,
  }),
}));
vi.mock("./web-auth-actions", () => ({
  createWebAuthActions: (
    _client: unknown,
    options: { providers?: Record<string, boolean | undefined> },
  ) => ({
    enabledSocialProviders: ["google", "apple", "github", "microsoft", "twitter"].filter(
      (provider) => options.providers?.[provider],
    ),
    isLastUsedMethod: () => false,
    lastUsedMethod: () => null,
    requestEmailOtp: vi.fn(),
    requestMagicLink: vi.fn(),
    restoreSession: vi.fn(),
    signInWithSocial: vi.fn(),
    signOut: vi.fn(),
    verifyEmailOtp: vi.fn(),
  }),
  WEB_SOCIAL_PROVIDER_LABEL: {
    apple: "Apple",
    github: "GitHub",
    google: "Google",
    microsoft: "Microsoft",
    twitter: "X",
  },
}));
vi.mock("./verified-signup-actions", () => ({
  createSignupPassword: vi.fn(async () => true),
}));
vi.mock("./toast", () => ({
  toast: {
    dismiss: vi.fn(),
    error: harness.toastError,
    info: vi.fn(),
    success: harness.toastSuccess,
  },
}));
vi.mock("./marketing/account-shell", () => ({
  MarketingAccountShell: ({ children }: { children: ReactNode }) => el("div", null, children),
}));

const el = createElement as unknown as (
  component: unknown,
  props?: unknown,
  ...children: unknown[]
) => ReactElement;

import { submitAuthAttempt, WebAuthPage } from "./web-auth-page";

const copy = getDictionary("en").auth;
const allDisabled = {
  apple: false,
  github: false,
  google: false,
  microsoft: false,
  twitter: false,
};

function renderPage(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    el(WebAuthPage, {
      apiUrl: "http://localhost:3300",
      callbackURL: "http://localhost:3300/auth",
      copy,
      locale: "en",
      providers: allDisabled,
      captureEnabled: true,
      ...overrides,
    }),
  );
}

describe("WebAuthPage", () => {
  it("renders a skeleton card while the session restores", () => {
    harness.session.isPending = true;
    const html = renderPage({ copy: getDictionary("de").auth, locale: "de" });
    harness.session.isPending = false;

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status"');
    expect(html).toContain(getDictionary("de").auth.restoringTitle);
    // No real buttons while pending — the card is placeholder bars only.
    expect(html).not.toContain("<button");
  });

  it("renders social providers first, then the divider, then email methods", () => {
    const html = renderPage({ providers: { ...allDisabled, github: true } });
    expect(html).toContain("GitHub");
    expect(html).not.toContain("Google");
    expect(html).toContain("Email me a code");
    expect(html).toContain("Create account");
    expect(html).not.toContain('autocomplete="new-password"');

    const github = html.indexOf("GitHub");
    const divider = html.indexOf("auth-divider");
    const emailCode = html.indexOf("Email me a code");
    expect(github).toBeGreaterThan(-1);
    expect(divider).toBeGreaterThan(github);
    expect(emailCode).toBeGreaterThan(divider);
  });

  it("keeps GitHub visible but disabled until OAuth is configured", () => {
    const html = renderPage();
    expect(html).toContain("Email me a code");
    expect(html).toContain("Email me a link");
    expect(html).toContain("GitHub");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?GitHub[\s\S]*?<\/button>/);
    expect(html).toContain("auth-divider");
  });

  it("renders the OTP email step fully in German under the de dictionary", () => {
    const de = getDictionary("de").auth;
    const html = renderPage({
      copy: de,
      initialStep: "otp-email",
      locale: "de",
    });

    expect(html).toContain(de.stepTitles["otp-email"]);
    expect(html).toContain(de.emailLabel);
    expect(html).toContain(de.emailMeCode);
    expect(html).toContain(de.back);
    // The regression this guards: no English card copy leaks through.
    expect(html).not.toContain("Email address");
    expect(html).not.toContain(">Email me a code<");
    expect(html).not.toContain("Choose another method");
  });

  it("renders the OTP verify step as six digit slots over a hidden input", () => {
    const html = renderPage({ initialStep: "otp-verify" });

    expect(html).toContain(copy.stepTitles["otp-verify"]);
    expect(html).toContain(copy.emailCodeLabel);
    // Six visual digit boxes, one real input (the hidden one inside OtpInput).
    expect(html.match(/data-otp-slot/g) ?? []).toHaveLength(6);
    expect(html.match(/<input/g) ?? []).toHaveLength(1);
    expect(html).toContain('id="auth-otp"');
    expect(html).toContain('autoComplete="one-time-code"');
  });

  it("renders password creation only in the post-OTP signup step", () => {
    const html = renderPage({ initialStep: "set-password" });

    expect(html).toContain("Create a password.");
    expect(html).toContain(copy.passwordLabel);
    expect(html).toContain("Create password");
    expect(html).toContain('autoComplete="new-password"');
    expect(html).not.toContain('id="auth-otp"');
  });

  it("renders back as a quiet arrow line above the step heading", () => {
    const html = renderPage({ initialStep: "otp-email" });
    expect(html).toMatch(/<button[^>]*class="auth-back"/);
    expect(html).not.toContain("auth-back button");
    const back = html.slice(html.indexOf('class="auth-back"'));
    expect(back).toContain("<svg");
    expect(back).toContain(copy.back);
    // Conventional placement: top-left of the card, before the title.
    expect(html.indexOf('class="auth-back"')).toBeLessThan(html.indexOf("<h1"));
  });
});

describe("submitAuthAttempt", () => {
  it("toasts the localized invalidCredentials message for a failed sign-in", async () => {
    harness.toastError.mockClear();
    const deErrors = getDictionary("de").auth.errors;
    const response = await submitAuthAttempt(
      async () => ({
        data: null,
        error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
      }),
      deErrors,
    );

    expect(response?.error).not.toBeNull();
    expect(harness.toastError).toHaveBeenCalledTimes(1);
    expect(harness.toastError).toHaveBeenCalledWith(deErrors.invalidCredentials);
    expect(harness.toastError).toHaveBeenCalledWith("E-Mail-Adresse oder Passwort ist falsch.");
  });

  it("toasts the generic message for thrown errors and unknown codes", async () => {
    harness.toastError.mockClear();
    const errors = getDictionary("en").auth.errors;

    await submitAuthAttempt(async () => {
      throw new Error("network down");
    }, errors);
    expect(harness.toastError).toHaveBeenLastCalledWith(errors.generic);

    await submitAuthAttempt(
      async () => ({ data: null, error: { code: "SOMETHING_NEW", message: "raw" } }),
      errors,
    );
    expect(harness.toastError).toHaveBeenLastCalledWith(errors.generic);
    expect(harness.toastError).toHaveBeenCalledTimes(2);
  });

  it("stays silent on success", async () => {
    harness.toastError.mockClear();
    const response = await submitAuthAttempt(
      async () => ({ data: { ok: true }, error: null }),
      getDictionary("en").auth.errors,
    );
    expect(response?.error).toBeNull();
    expect(harness.toastError).not.toHaveBeenCalled();
  });
});
