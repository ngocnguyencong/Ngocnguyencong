# app/(app)/settings/appearance.tsx

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

Appearance section: System/Light/Dark/Match-web-app pickers wired to
`updateThemeMode` (persisted via SecureStore), a "Color pack" card
listing the account's synced web packs (`accessibilityRole="radio"` +
`accessibilityState`, canvas+signal swatch, `selectSyncedTheme` with an
error line on PUT failure), plus a live palette preview card.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-15 | "Match web app" mode + synced "Color pack" card | Devin |
| 2026-09-28 | Created | Devin |
