# apps/mobile/src/auth/actions.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Mobile auth action facade over the better-auth client: `requestEmailOtp`,
`verifyEmailOtp`, `signInWithGoogle`/`signInWithApple`, `restoreSession`,
`signOut`. `createMobileAuthActions` validates `callbackURL` against the
production deep-link allowlist (`isAllowedProductionDeepLink`,
default `productionAuthCallbackURL` from `src/navigation/deep-links`).

## Important Notes / NEVER Change

- `MobileAuthActionClient` is a minimal structural interface so tests use
  recording mocks.
- No `signIn.email`/password wrapper — mobile has no signup UI, so a
  password field is a dead end (removed 2026-09-23 with the web chooser).
- OAuth callbacks must stay inside the approved production deep-link
  policy — the constructor throws otherwise.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | `MobileAuthResponse.error.message` widened to `string | undefined` for exactOptionalPropertyTypes compatibility with the real client union | Devin |
| 2026-09-23 | Created mirror; `signInWithPassword` + `signIn.email` removed from the client interface | Devin |
