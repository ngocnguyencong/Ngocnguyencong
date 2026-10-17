# src/theme/synced.ts

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

Client + cache for the "Match web app" (`synced`) theme mode —
`fetchAppearance` / `updateSyncedTheme` over `MobileApiClient`
(`/api/mobile/appearance`), strict response validation, and a SecureStore
cold-start cache.

## Important Notes

- Response validation is strict: every palette color field and every
  status `{color, foreground, soft}` must match `^#[0-9a-f]{6}$`i;
  malformed packs are dropped, a malformed envelope throws.
- `themeId` = `preferences.theme` from the snapshot (the synced web
  color-pack id).
- SecureStore cache key `supastack.theme.synced` stores
  `{packId, palette}` so "Match web app" paints instantly offline / on
  cold start; cache reads re-validate and best-effort like
  `preference.ts` — failures never break rendering.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Created for cross-device appearance sync (WP1) | Devin |
