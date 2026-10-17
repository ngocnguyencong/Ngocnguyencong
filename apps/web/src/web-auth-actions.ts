export type WebSocialProvider = "apple" | "github" | "google" | "microsoft" | "twitter";

export const WEB_SOCIAL_PROVIDERS = [
  "google",
  "apple",
  "github",
  "microsoft",
  "twitter",
] as const satisfies readonly WebSocialProvider[];

export const WEB_SOCIAL_PROVIDER_LABEL: Record<WebSocialProvider, string> = {
  apple: "Apple",
  github: "GitHub",
  google: "Google",
  microsoft: "Microsoft",
  twitter: "X",
};

export interface WebAuthResponse {
  data: unknown;
  error: { code?: string | undefined; status?: number | undefined; message?: string } | null;
}

/** Per-call fetch options accepted by better-auth client methods. */
export interface WebAuthCallOptions {
  headers?: Record<string, string>;
}

export interface WebAuthActionClient {
  emailOtp: {
    sendVerificationOtp(
      input: {
        email: string;
        type: "sign-in";
      },
      options?: WebAuthCallOptions,
    ): Promise<WebAuthResponse>;
  };
  getLastUsedLoginMethod?: () => string | null;
  getSession(): Promise<WebAuthResponse>;
  signIn: {
    emailOtp(
      input: { email: string; otp: string },
      options?: WebAuthCallOptions,
    ): Promise<WebAuthResponse>;
    magicLink(
      input: { callbackURL: string; email: string },
      options?: WebAuthCallOptions,
    ): Promise<WebAuthResponse>;
    social(
      input: { callbackURL: string; provider: WebSocialProvider },
      options?: WebAuthCallOptions,
    ): Promise<WebAuthResponse>;
  };
  signOut(): Promise<WebAuthResponse>;
}

export interface WebAuthActionConfig {
  callbackURL: string;
  /** Returns the current single-use captcha token, when a provider is on. */
  getCaptchaToken?: () => string | null;
  providers: Readonly<Record<WebSocialProvider, boolean>>;
}

export function createWebAuthActions(client: WebAuthActionClient, config: WebAuthActionConfig) {
  const enabledSocialProviders = WEB_SOCIAL_PROVIDERS.filter(
    (provider) => config.providers[provider],
  );
  const captchaOptions = (): WebAuthCallOptions | undefined => {
    const token = config.getCaptchaToken?.();
    return token ? { headers: { "x-captcha-response": token } } : undefined;
  };

  return Object.freeze({
    enabledSocialProviders,
    isLastUsedMethod: (method: string) => client.getLastUsedLoginMethod?.() === method,
    lastUsedMethod: () => client.getLastUsedLoginMethod?.() ?? null,
    requestEmailOtp: (email: string) =>
      client.emailOtp.sendVerificationOtp({ email, type: "sign-in" }, captchaOptions()),
    requestMagicLink: (email: string) =>
      client.signIn.magicLink({ callbackURL: config.callbackURL, email }, captchaOptions()),
    restoreSession: () => client.getSession(),
    async signInWithSocial(provider: WebSocialProvider) {
      if (!config.providers[provider]) {
        throw new Error(`${WEB_SOCIAL_PROVIDER_LABEL[provider]} sign-in is not configured.`);
      }

      return client.signIn.social({ callbackURL: config.callbackURL, provider });
    },
    signOut: () => client.signOut(),
    verifyEmailOtp: (email: string, otp: string) =>
      client.signIn.emailOtp({ email, otp }, captchaOptions()),
  });
}
