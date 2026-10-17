import { getDictionary } from "@supastack/i18n";

export type TransactionalMailTemplatePreview = Readonly<{
  id: string;
  subject: string;
  text: string;
  footer: string;
  lang: string;
  category: "transactional";
}>;

const enMail = getDictionary("en").mail;

const previewChrome = Object.freeze({ footer: enMail.transactionalFooter, lang: "en" });

/** Static catalog for /mail-preview when the process outbox is empty. */
export const TRANSACTIONAL_MAIL_TEMPLATE_PREVIEWS: readonly TransactionalMailTemplatePreview[] =
  Object.freeze([
    Object.freeze({
      id: "auth-otp",
      category: "transactional" as const,
      ...previewChrome,
      subject: enMail.otpSignInSubject,
      text: enMail.otpSignInBody("123456"),
    }),
    Object.freeze({
      id: "auth-magic-link",
      category: "transactional" as const,
      ...previewChrome,
      subject: enMail.magicLinkSubject,
      text: enMail.magicLinkBody(
        "https://app.example.test/api/auth/magic-link/verify?token=preview-token",
      ),
    }),
    Object.freeze({
      id: "workspace-invite",
      category: "transactional" as const,
      ...previewChrome,
      subject: enMail.inviteSubject,
      text: `teammate@example.com\n\n${enMail.inviteBody(
        "Acme",
        "https://app.example.test/invite/preview-token",
      )}\n\nIf you did not expect this email, ignore it.`,
    }),
    Object.freeze({
      id: "early-access-invite",
      category: "transactional" as const,
      ...previewChrome,
      subject: enMail.earlyAccessSubject,
      text: `${enMail.earlyAccessBody(
        "https://app.example.test/auth?invite=preview-code",
      )}\n\nIf you did not join the waitlist, ignore this email.`,
    }),
    Object.freeze({
      id: "ai-task-complete",
      category: "transactional" as const,
      ...previewChrome,
      subject: enMail.aiCompleteSubject,
      text: enMail.aiCompleteBody,
    }),
    Object.freeze({
      id: "billing-payment-failed",
      category: "transactional" as const,
      ...previewChrome,
      subject: enMail.billingFailedSubject,
      text: enMail.billingFailedBody,
    }),
  ]);
