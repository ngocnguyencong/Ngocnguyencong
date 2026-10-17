# src/user-appearance.ts

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

Per-user appearance preference store backing the cross-device theme sync —
`createDrizzleUserAppearanceRepository` implements `get`/`upsert` against
`user_appearance` (`user_id` PK → `user.id` cascade, `preferences` jsonb).

## Important Notes

- Scoped by `userId`, NOT `workspaceId` — appearance follows the account
  across browsers, the desktop webview shell, and mobile.
- `preferences` is opaque JSON here on purpose: validating it against the
  web theme catalogs lives in `apps/web/src/theme/appearance.ts`
  (`parseAppearancePreferences`), so a removed pack/style can never corrupt
  the row or make the repo layer depend on web code.
- `upsert` uses `onConflictDoUpdate` on the PK and returns the persisted
  `{preferences, updatedAt}` projection — `updatedAt` is the conflict
  stamp clients reconcile against `supastack-appearance-updated-at`.
- `UserAppearanceRepository` is injectable — the web sync module
  (`apps/web/src/appearance-sync.ts`) is unit-tested against a stub.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Created for cross-device appearance sync (WP1) | Devin |
