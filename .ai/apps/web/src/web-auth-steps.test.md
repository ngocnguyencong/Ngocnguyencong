# apps/web/src/web-auth-steps.test.ts

2026-10-03: Pins the create-account OTP transition to `set-password` and the
back behavior after OTP consumption.

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Unit tests for the `/auth` step machine: panel visibility per step,
`authStepTitle` heading lookup (against `getDictionary("en").auth.stepTitles`),
and `reduceAuthStep` transitions (choose → otp/magic-link and back; back is a
no-op on choose/signed-in). Also guards that password/reset steps never
re-enter `AUTH_STEPS`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Password/reset transition tests replaced by an `AUTH_STEPS` absence guard + back no-op cases | Devin |
| 2026-09-23 | `authStepTitle` calls updated for the localized-titles signature (hard-coded table removed) | Devin |
