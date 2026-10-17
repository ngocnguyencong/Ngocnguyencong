import { createHmac } from "node:crypto";

import type { EmailOtpMessage, MagicLinkMessage } from "@supastack/auth";
import type { EmailSender } from "@supastack/email";
import { DEFAULT_LOCALE, getDictionary, isAppLocale, type AppLocale } from "@supastack/i18n";

import { createRateLimiter } from "./rate-limit";

export type AuthMailDeliveryOptions = Readonly<{
  locale?: string | null | undefined;
}>;

export type AuthMailAdmissionOptions = Readonly<{
  mailLimiter?: ReturnType<typeof createRateLimiter>;
}>;

const authMailLimiter = createRateLimiter({
  limit: 5,
  windowMs: 60 * 60 * 1000,
});

/**
 * Admission runs before Better Auth writes or replaces its one-use OTP/link
 * token. Keys contain only a keyed digest of the normalized mailbox; counters
 * are bounded and process-local like the auth route's in-flight policy.
 */
export function createAuthMailAdmission(
  secret: string,
  options: AuthMailAdmissionOptions = {},
): (email: string) => Promise<boolean> {
  const limiter = options.mailLimiter ?? authMailLimiter;
  return async (email) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || normalized.length > 320) return false;
    const recipientKey = createHmac("sha256", secret).update(normalized).digest("base64url");
    return Promise.resolve(limiter.check(`auth-mail:${recipientKey}`)).then(
      ({ allowed }) => allowed,
    );
  };
}

function resolveMailLocale(locale: AuthMailDeliveryOptions["locale"]): AppLocale {
  return isAppLocale(locale) ? locale : DEFAULT_LOCALE;
}

/**
 * Pre-auth messages do not yet own a workspace row, so this adapter sends them
 * transactionally without inserting them into workspace-owned delivery storage.
 */
export function createAuthOtpDelivery(sender: EmailSender, options: AuthMailDeliveryOptions = {}) {
  const locale = resolveMailLocale(options.locale);
  const copy = getDictionary(locale).mail;
  return async (message: EmailOtpMessage): Promise<void> => {
    const isReset = message.type === "forget-password";
    await sender.send({
      category: "transactional",
      footer: copy.transactionalFooter,
      lang: locale,
      subject: isReset ? copy.otpResetSubject : copy.otpSignInSubject,
      text: isReset ? copy.otpResetBody(message.otp) : copy.otpSignInBody(message.otp),
      to: message.email,
      workspaceId: "pre-auth",
    });
  };
}

/** Same pre-auth transactional boundary for magic-link verify URLs. */
export function createAuthMagicLinkDelivery(
  sender: EmailSender,
  options: AuthMailDeliveryOptions = {},
) {
  const locale = resolveMailLocale(options.locale);
  const copy = getDictionary(locale).mail;
  return async (message: MagicLinkMessage): Promise<void> => {
    await sender.send({
      category: "transactional",
      footer: copy.transactionalFooter,
      lang: locale,
      subject: copy.magicLinkSubject,
      text: copy.magicLinkBody(message.url),
      to: message.email,
      workspaceId: "pre-auth",
    });
  };
}
