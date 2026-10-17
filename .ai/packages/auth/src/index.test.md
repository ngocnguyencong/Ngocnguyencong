# packages/auth/src/index.test.ts

> Last updated: 2026-10-04 | Protection: STANDARD

## Purpose

Coverage for `index.ts` — `createAuthCoreV1Config` trusted-origin/provider
composition and `createBetterAuthOptions` plugin + `trustedOrigins` wiring.

## Coverage

- Native enrollment request behavior is exercised through the real memory
  handler in `mfa-handler.test.ts`; this option-factory suite stays focused on
  provider, plugin, CAPTCHA, and trusted-origin composition.

- Configured Turnstile covers both OTP password-reset issuing aliases;
  these must not bypass the provider's CAPTCHA gate.

- Password signup is disabled; credential sign-in requires verified email, and password resets revoke sessions.

- `createAuthCoreV1Config` — baseURL, configured social providers, exact
  production origins; wildcard/local-HTTP/path static origins rejected.
- `createBetterAuthOptions` — hashed emailOTP/magicLink stores + delivery
  callbacks, plugin order, account-linking flags, conditional Turnstile
  captcha, `resolveLastLoginMethod` path mapping.
- With Turnstile configured, the plugin receives the credential and token-
  issuing endpoint list, including both email-OTP reset issuers and the core
  `/request-password-reset` and `/forget-password` aliases. Real handler
  CAPTCHA behavior for both core aliases and the email-OTP reset issuers is
  covered separately in `verified-signup-handler.test.ts`.
- Native passkey/TOTP enrollment request behavior is covered through the real
  memory handler in `mfa-handler.test.ts`; this suite focuses on option
  composition. The real handler suite covers TOTP enrollment racing mailbox
  recovery, stale `/link-social` and normal OAuth callbacks, and active verified
  controls; adapter-level TOTP-session and `/link-social` checks live in
  `server.test.ts`.
- The explicit `admitAuthMail` dependency is supplied by test fixtures; the
  mail-admission implementation is verified at the web delivery boundary.
- Dynamic trusted origins — valid origin merged over the static list;
  wildcard, production `http://`/local, credentials/path/query/fragment,
  and `null`/`undefined`/non-string entries dropped; `http://` kept when
  `app.environment !== "production"`; provider rejection, synchronous
  throw, or a non-array return falls back to the static list (no throw);
  dynamic entries deduped against the static list.

## Bug Fixes

- 2026-09-27 — Dynamic-origin validation cases added test-first: the six
  unsafe-input cases (wildcards, prod `http://`, credentials/path,
  `null`/`undefined`, provider rejection, static-list duplication) failed
  against the previous unvalidated spread, then passed with the fix.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | +sync-throwing provider case; stale resolved-list cast fixed | Devin |
| 2026-09-27 | +dynamic trusted-origins validation/fail-closed coverage | Devin |

## Test Boundary

- Composition fixtures provide an explicit async allow stub for
  `admitAuthMail`; recipient quota and mail-admission ordering are covered at
  the web delivery boundary.
- This suite does not make provider or external database calls.
