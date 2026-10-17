export const AUTH_STEPS = [
  "choose",
  "otp-email",
  "otp-verify",
  "set-password",
  "magic-link-email",
  "magic-link-sent",
  "signed-in",
] as const;

export type AuthStep = (typeof AUTH_STEPS)[number];

export type AuthStepEvent =
  | { type: "select-otp" }
  | { type: "select-sign-up" }
  | { type: "select-magic-link" }
  | { type: "otp-sent" }
  | { type: "otp-verified" }
  | { type: "password-created" }
  | { type: "magic-link-sent" }
  | { type: "back" };

export interface AuthStepVisibility {
  choose: boolean;
  otpEmail: boolean;
  otpVerify: boolean;
  setPassword: boolean;
  magicLinkEmail: boolean;
  magicLinkSent: boolean;
  signedIn: boolean;
}

/**
 * Step titles come from `MessageDictionary.auth.stepTitles` — the caller
 * passes the locale-resolved record so this module stays free of i18n
 * imports.
 */
export function authStepTitle(step: AuthStep, titles: Readonly<Record<AuthStep, string>>): string {
  return titles[step];
}

export function authStepVisibility(step: AuthStep): AuthStepVisibility {
  return {
    choose: step === "choose",
    otpEmail: step === "otp-email",
    otpVerify: step === "otp-verify",
    setPassword: step === "set-password",
    magicLinkEmail: step === "magic-link-email",
    magicLinkSent: step === "magic-link-sent",
    signedIn: step === "signed-in",
  };
}

export function reduceAuthStep(step: AuthStep, event: AuthStepEvent): AuthStep {
  switch (event.type) {
    case "select-otp":
      return step === "choose" ? "otp-email" : step;
    case "select-sign-up":
      return step === "choose" ? "otp-email" : step;
    case "select-magic-link":
      return step === "choose" ? "magic-link-email" : step;
    case "otp-sent":
      return step === "otp-email" ? "otp-verify" : step;
    case "otp-verified":
      return step === "otp-verify" ? "set-password" : step;
    case "password-created":
      return step === "set-password" ? "signed-in" : step;
    case "magic-link-sent":
      return step === "magic-link-email" ? "magic-link-sent" : step;
    case "back":
      switch (step) {
        case "otp-email":
        case "otp-verify":
          return "choose";
        case "set-password":
          return "signed-in";
        case "magic-link-email":
        case "magic-link-sent":
          return "choose";
        default:
          return step;
      }
    default:
      return step;
  }
}
