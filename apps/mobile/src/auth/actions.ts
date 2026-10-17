import { isAllowedProductionDeepLink, productionAuthCallbackURL } from "../navigation/deep-links";

export interface MobileAuthResponse {
  data: unknown;
  error: { message?: string | undefined } | null;
}

export interface MobileAuthActionClient {
  emailOtp: {
    sendVerificationOtp(input: { email: string; type: "sign-in" }): Promise<MobileAuthResponse>;
  };
  getSession(): Promise<MobileAuthResponse>;
  signIn: {
    emailOtp(input: { email: string; otp: string }): Promise<MobileAuthResponse>;
    social(input: {
      callbackURL: string;
      provider: "apple" | "google";
    }): Promise<MobileAuthResponse>;
  };
  signOut(): Promise<MobileAuthResponse>;
}

function requireApprovedCallbackUrl(callbackURL: string): void {
  if (!isAllowedProductionDeepLink(callbackURL)) {
    throw new Error("OAuth callbacks must use an approved production deep-link origin.");
  }
}

export function createMobileAuthActions(
  client: MobileAuthActionClient,
  callbackURL = productionAuthCallbackURL,
) {
  requireApprovedCallbackUrl(callbackURL);

  return {
    requestEmailOtp: (email: string) =>
      client.emailOtp.sendVerificationOtp({ email, type: "sign-in" }),
    restoreSession: () => client.getSession(),
    signInWithApple: () => client.signIn.social({ callbackURL, provider: "apple" }),
    signInWithGoogle: () => client.signIn.social({ callbackURL, provider: "google" }),
    signOut: () => client.signOut(),
    verifyEmailOtp: (email: string, otp: string) => client.signIn.emailOtp({ email, otp }),
  };
}
