# src/appearance-sync.ts

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

Server-only accessor over the `user_appearance` repository —
`getUserAppearance` / `saveUserAppearance` for the account and mobile
appearance API routes.

## Important Notes

- `createAppearanceSync(repository)` takes an injectable
  `UserAppearanceRepository` for unit tests; the module-level singleton
  lazily builds the Drizzle repo on `database` from `auth-runtime`.
- `get` re-validates stored JSON through `parseAppearancePreferences`
  on every read — a row whose catalog ids went stale (removed pack or
  style) reads back `preferences: null` while `updatedAt` still reports,
  so clients can reconcile stamps.
- `save` upserts and returns `{preferences, updatedAt}`; `updatedAt` is
  the authoritative stamp the client adopts as its local sync stamp.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Created for cross-device appearance sync (WP1) | Devin |
