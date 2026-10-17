# apps/web/src/web-auth-actions.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Framework-agnostic wrapper over the better-auth browser client: one named
action per auth call (`requestEmailOtp`, `verifyEmailOtp`,
`signInWithSocial`, `requestMagicLink`, `restoreSession`, `signOut`) plus
provider gating (`enabledSocialProviders`, `isLastUsedMethod`). Password
sign-in and reset wrappers were removed with the `/auth` password step —
server-side `emailAndPassword` stays enabled for API/seed/Auth.js use.

## Important Notes / NEVER Change

- `WebAuthActionClient` is a minimal structural interface so tests use a
  recording mock — the real client is `createWebAuthClient` output.
- `config.getCaptchaToken` (optional) supplies a single-use Turnstile token;
  when set, every credential/token-issuing call sends it as the
  `x-captcha-response` header (the better-auth `captcha` plugin contract).
  Sign-out/session/social stay unprotected by design.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | `signIn.email`, `emailOtp.resetPassword`, `signInWithPassword`, `requestPasswordReset`, `resetPassword` dropped from `WebAuthActionClient` + actions; `sendVerificationOtp` narrowed to `type: "sign-in"` (no UI creates passwords — reset flow was unreachable) | Devin |
| 2026-09-23 | `WebAuthResponse.error` widened to `{ code?, status?, message? }` so `authErrorMessage` can map Better Auth codes (runtime already returned them) | Devin |
| 2026-09-22 | `WebAuthCallOptions` + `getCaptchaToken` threading for captcha | Devin |
