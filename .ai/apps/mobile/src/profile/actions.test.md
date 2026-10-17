# apps/mobile/src/profile/actions.test.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Vitest coverage for `createMobileProfileActions.updateName` over a
stubbed `MobileProfileClient`.

## What It Does

- Trims + forwards `{name}` to `client.updateUser`; success →
  `{ok:true, "Profile saved."}`.
- Rejects empty and >100-char names without a request.
- Maps `{error}` responses and thrown errors to the generic failure
  message (no detail leakage) — mirrors `web-settings-actions.test.ts`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | Created | Devin |
