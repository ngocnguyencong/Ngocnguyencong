# apps/mobile/src/profile/actions.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Account-profile actions over the Better Auth client — the mobile twin of
`apps/web/src/web-settings-actions.ts`. `updateUser` posts to
`/api/auth/update-user`, which the auth server already serves for cookie
sessions, so no `/api/mobile` BFF is needed.

## What It Does

- `createMobileProfileActions(client)` → `updateName(value)` — trims,
  enforces the shared 1–100-char contract, maps the `{error}` response
  and thrown errors to `{ok, message}` results. Failure messages are
  generic — server error details never leak into the UI.
- `MobileProfileClient` is the minimal structural interface (`updateUser`);
  the session provider's `auth` client satisfies it directly.

## Dependencies

- None beyond the injected client — the screen passes `auth` from
  `useRequiredMobileApp()`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | Created (name-only profile editing) | Devin |
