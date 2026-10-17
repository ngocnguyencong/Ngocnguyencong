# apps/web/src/auth-otp-delivery.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose

Adapt Better Auth's pre-workspace OTP and magic-link callbacks to the selected transactional email sender, with shared recipient admission for token-issuing messages.

## Public API

| Name | Description |
|------|-------------|
| `createAuthMailAdmission` | Returns an async normalized-mailbox admission check, using the shared five-per-hour limiter by default or an injected limiter in tests. |
| `createAuthOtpDelivery` | Maps OTP messages to localized transactional mail under `workspaceId: "pre-auth"`. |
| `createAuthMagicLinkDelivery` | Maps magic-link URLs to the same transactional boundary. |

## Behavior

- Admission trims and lowercases the mailbox, rejects empty or over-320
  character values, then uses a keyed HMAC as the limiter key. The default
  limiter permits five sends per recipient per hour. Its counters are bounded
  and process-local; raw mailbox addresses are not used as keys.
- Better Auth calls admission in `hooks.before`, before it persists or
  replaces OTP/link tokens. It covers verification OTP, magic-link, email
  change, and all four password-reset request routes:
  `/email-otp/request-password-reset`, `/forget-password/email-otp`,
  `/request-password-reset`, and `/forget-password`. Rejected requests get a
  generic 429 and leave the last delivered proof usable. Delivery callbacks
  send admitted messages rather than silently discarding replacement codes.
- OTP delivery uses reset copy only for `forget-password`; other OTP types use
  sign-in copy. Magic-link and OTP copy come from the selected supported
  dictionary locale, falling back to the default locale. The sender receives
  `lang` and the transactional footer so the HTML shell is localized.
- These are pre-auth transactional messages: they have no workspace row and
  never enter outreach delivery.

## Important Notes / NEVER Change

- Keep admission independent of account existence so its response cannot reveal
  whether a mailbox is registered.
- Keep the middleware admission check before token persistence. A mail adapter
  that drops a callback after Better Auth stores the new token would invalidate
  the last code the recipient actually received.
- Never log OTPs or magic-link tokens; never route them through outreach.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-04 | Document five-per-hour admission before OTP/link persistence, including all reset aliases | Codex |
| 2026-09-22 | Include locale and transactional footer in pre-auth mail | Devin |
