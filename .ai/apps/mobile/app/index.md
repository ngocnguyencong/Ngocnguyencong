# apps/mobile/app/index.tsx

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Entry gate: restores the SecureStore session (spinner), redirects
signed-in users to `/home`, and renders the passwordless sign-in card
(email OTP request → verify, plus Google/Apple social).

## Important Notes

- The OTP input only appears after a successful `requestEmailOtp` —
  failures keep the user on the email step with the error inline.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Rewritten as auth gate + themed sign-in; app content moved to `/(app)` | Devin |
| 2026-09-23 | Password field/sign-in removed from the account screen — mobile is now email OTP + Google/Apple only (no signup path exists to create a password) | Devin |
| 2026-09-22 | Added feature board entry point | Devin |
