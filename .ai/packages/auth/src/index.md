# packages/auth/src/index.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose

Policy-owned Better Auth option factories: `createAuthCoreV1Config` (baseURL,
secret, social providers, trusted origins) and `createBetterAuthOptions`
(plugins + account linking). DB adapter wiring stays in the app composition
layer (`server.ts`).

## What It Does

- Social providers: apple/github/google/microsoft/twitter — each only enabled
  when `AUTH_<P>_ENABLED` + client id/secret validate in `packages/config`.
- Plugins: emailOTP (hashed), magicLink (hashed), expo, lastLoginMethod
  (`resolveLastLoginMethod` maps endpoint paths), twoFactor, passkey, admin.
- `CAPTCHA_ENDPOINTS` + conditional `captcha` plugin: when
  `providers.captcha.kind === "turnstile"`, Cloudflare Turnstile verifies the
  `x-captcha-response` header on credential/token-issuing endpoints. The list
  includes `/sign-in/email`, `/sign-in/email-otp`, `/sign-in/magic-link`,
  `/email-otp/send-verification-otp`, `/sign-up/email`, the email-OTP reset
  request paths, and the core `/request-password-reset` and `/forget-password`
  aliases. Token-consuming endpoints stay unlisted because their code or
  token is the proof.
- Native password signup remains disabled. Email-OTP sign-in establishes the
  verified session used by the server-side first-password action; a one-use
  proof is bound to the exact user and session and expires after 15 minutes.
- A `hooks.before` allowlist requires an authoritative session with
  `emailVerified === true` and `banned !== true` before
  `/passkey/generate-register-options`, `/passkey/verify-registration`, or
  `/two-factor/enable` reaches its plugin. Missing sessions receive 401;
  unverified or banned owners receive 403 before authenticator writes.
- `server.ts` checks that the authoritative session user matches the target
  `data.user.id` for OAuth `link-account` callbacks, then requires the persisted
  owner to be verified and nonbanned. TOTP activation/session creation and
  authenticated `/link-social` account creation also recheck persisted
  owner/session/factor state; keep these boundaries to close requests that
  began before mailbox recovery revoked their session or factor.
- `account.updateAccountOnSignIn: true` keeps Better Auth able to refresh
  provider links removed during mailbox recovery. Existing OAuth sign-in also
  requires its persisted user to be verified and nonbanned, regardless of
  invite-only mode.

## Important Notes / NEVER Change

- Native IP rate limiting is disabled to avoid the shared unknown-IP bucket.
  The catch-all owns trusted-ingress and concurrent-request admission.
  Password login uses a bounded normalized-email HMAC gate; OTP verification
  permits three attempts. Recipient mail admission runs in `hooks.before`
  ahead of OTP/link persistence for verification OTP, magic links, email
  changes, and all four password-reset request paths. Rejected requests do not
  replace the last delivered code, and admitted delivery callbacks must send.

- `createBetterAuthOptions` disables native IP throttling because the native
  unknown-IP fallback is a shared bucket. Keep the catch-all's trusted-ingress
  admission separate from the normalized-mailbox gates.
- Trusted origins must stay exact HTTPS origins in production — no wildcards.
- Passing `endpoints` to the captcha plugin replaces its defaults. Keep the
  sign-up/sign-in and all reset request paths in `CAPTCHA_ENDPOINTS` when
  editing. The core reset aliases are covered only when Turnstile is enabled.

## Bug Fixes

- 2026-09-27 — Dynamic trusted origins (`dynamicTrustedOrigins` — active
  `workspace_domain` hostnames for white-label custom domains) were spread
  into `trustedOrigins` raw: no validation, `null`/`undefined` leaked into
  Better Auth's comparison list, and a provider rejection threw on EVERY
  auth request. Now: provider call is wrapped
  (`Promise.resolve().then(() => provider(request))` + `.catch(() => [])`)
  so rejection AND synchronous throw fall back to the static list (fail
  closed); non-array returns and non-string entries filtered; survivors run
  through the same `toExactWebOrigin(origin, production)` policy as static
  origins — invalid entries are dropped, never trusted; results deduped
  against the static list via `Set`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Resolver covers sync-throwing providers + hoisted prod check | Devin |
| 2026-09-27 | Validate dynamic trusted origins + fail closed on lookup errors | Devin |
| 2026-10-04 | Add the core reset aliases to the Turnstile endpoint list; document the before-persistence mail gate and OTP-first password setup | Codex |
| 2026-10-04 | Require verified active sessions for native passkey and two-factor enrollment | Codex |
| 2026-10-04 | Guard TOTP state/session and authenticated social-link writes with persisted identity checks | Codex |
| 2026-09-22 | Conditional Turnstile `captcha` plugin + `CAPTCHA_ENDPOINTS` | Devin |
