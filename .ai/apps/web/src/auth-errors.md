# apps/web/src/auth-errors.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Pure mapping from Better Auth / Auth.js error shapes to localized sign-in
copy. `authErrorMessage(error, errors)` looks up `error.code` in
`CODE_TO_KEY` (credential failures → `invalidCredentials`, bad codes →
`invalidCode`, expired → `expiredCode`, `EMAIL_NOT_VERIFIED`, `status ===
429` or `TOO_MANY_REQUESTS` → `tooManyRequests`) and falls back to
`generic` — the raw server `message` is never returned.

## Important Notes / NEVER Change

- Unknown/missing codes MUST resolve to `generic`; leaking the raw English
  server string was the bug this file fixes.
- The `errors` argument is the dictionary's `auth.errors` section
  (`AuthErrorCopy`), resolved server-side and passed as a prop — this file
  stays i18n-agnostic so it is unit-testable.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created | Devin |
