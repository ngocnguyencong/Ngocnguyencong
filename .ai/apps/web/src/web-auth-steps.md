# apps/web/src/web-auth-steps.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Pure step machine for `/auth`: `AuthStep` ids, `AUTH_STEPS`,
`authStepVisibility` (which panel shows per step), `reduceAuthStep`
(transitions), `authStepTitle` (heading lookup). The `set-password` step is
reachable only after the signup-mode OTP has been verified; the server action
independently requires a verified Better Auth session.

## Important Notes / NEVER Change

- `authStepTitle(step, titles)` takes the locale-resolved
  `MessageDictionary["auth"]["stepTitles"]` record — this module stays
  free of i18n imports; never re-add a hard-coded English title table.
- `reduceAuthStep` is pure — side effects (requests, toasts) live in
  `web-auth-page.tsx`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Steps reduced to choose/otp-email/otp-verify/magic-link-email/magic-link-sent/signed-in — `password`, `reset-request`, `reset-confirm` and their events (`select-password`, `forgot-password`, `reset-sent`, `reset-complete`) removed; no signup exists so the password path was unreachable dead weight | Devin |
| 2026-09-23 | `authStepTitle` now takes the localized titles record; the hard-coded `AUTH_STEP_TITLES` English table was removed (de/es/fr cards showed English headings) | Devin |
