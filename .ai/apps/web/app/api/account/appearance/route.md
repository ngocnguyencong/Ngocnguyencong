# app/api/account/appearance/route.ts

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

`GET`/`PUT /api/account/appearance` — the signed-in user's synced
appearance snapshot for web browsers and the desktop Tauri webview.

## Important Notes

- GET → `{preferences, updatedAt}` (both null when never synced); 401
  `{error: {code: "unauthorized"}}` signed out. `Cache-Control: no-store`.
- PUT JSON `{preferences}` → strict `parseAppearancePreferences`
  validation (400 `invalidPreferences`), same-origin Origin-header check
  against `serverConfig.app.webUrl` (403 — same `hasTrustedOrigin`
  pattern as `app/api/admin/credits/route.ts`), bounded body via
  `readBoundedJson` (413 / 400 `invalidJson`), 200 with the saved shape.
- All reads/writes are scoped by `session.user.id` — user-owned data,
  not workspace-scoped.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Created for cross-device appearance sync (WP1) | Devin |
