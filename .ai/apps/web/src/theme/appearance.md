# src/theme/appearance.ts

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

Isomorphic (never "server-only") heart of cross-device appearance sync:
the `AppearancePreferences` wire shape, strict validation, DOM snapshot
read/apply, and the local change-stamp/event contract the sync client
and ThemePicker share.

## Important Notes

- `AppearancePreferences` = `{style: string | null, theme, density,
  radius, font, layout, toastStyle}`. `style` holds a STYLE_CATALOG id
  only while the six axes equal that bundle — same contract as
  `currentStyleId()`; custom mixes store `null`.
- `parseAppearancePreferences(input)` is strict: every axis a known
  catalog id, `style` a style id or null, extra keys dropped; anything
  else → `null` so a removed pack degrades to "no preferences".
- `readAppearanceSnapshot()` reads `<html data-*>` + `currentStyleId()`.
- `applyAppearanceSnapshot(prefs, updatedAt?)` runs every axis through
  the existing `apply*` persisters (localStorage + cookies stay the
  boot-time authority), persists the style id only when its bundle still
  matches, skips `runThemeTransition` (background sync must not animate),
  stamps the server's `updatedAt`, and fires
  `supastack:appearance-applied` so an open ThemePicker re-reads the DOM.
- `markAppearanceChanged()` stamps `Date.now()` into localStorage key
  `supastack-appearance-updated-at` and fires
  `supastack:appearance-change` — called from user-initiated paths only
  (ThemePicker handlers, marketing ThemeMenu), NEVER from inside `apply*`
  or the snapshot apply, so a server state never echoes back as a local
  edit.
- `styleIdForPreferences` / `appearanceFromStyle` are the bundle-match
  helpers the mobile BFF uses when merging a color-pack pick.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Created for cross-device appearance sync (WP1) | Devin |
