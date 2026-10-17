# app/api/mobile/appearance/route.ts

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

Mobile BFF for appearance sync — `GET` returns the synced prefs plus
`packs`: every THEME_CATALOG color pack pre-mapped onto the mobile
`ThemePalette` contract (`mobileAppearancePacks()`); `PUT {theme}`
records a pack pick.

## Important Notes

- PUT merges the picked `theme` onto the stored prefs (or the
  `DEFAULT_STYLE_ID` bundle when none exist), then sets `style` via
  `styleIdForPreferences` — a style id survives only while the merged
  axes still equal that bundle (same custom-mix semantics as
  `currentStyleId()`).
- Unknown `theme` ids → 400 `invalidTheme`; body bounded via
  `readBoundedJson` (413/400); 401 `{code: "unauthorized"}` signed out;
  `Cache-Control: no-store`.
- Cookie-authenticated mobile client (`MobileApiClient`) — no
  Origin-header CSRF gate needed; `api/mobile` routes follow the mobile
  route auth pattern.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Created for cross-device appearance sync (WP1) | Devin |
