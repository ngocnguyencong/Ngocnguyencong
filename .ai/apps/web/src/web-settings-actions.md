# src/web-settings-actions.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Client-side settings action helpers: `createWebSettingsActions(client)`
wraps the Better Auth client (`updateUser`, `signOut`) and normalizes
each call into a `SettingsResult { ok, message }` the settings page
toasts — never throws.

## Important Notes

- `perform` collapses `{error}` responses and thrown exceptions into the
  same failure message — the UI branch stays uniform.
- `updateName` validates 1–100 chars client-side before calling the auth
  client; this module predates the `?status=` redirect convention the
  workspace-level server actions (members, organization, usage) use —
  account-level actions here return results instead.
- Pure/injectable (the `WebSettingsClient` interface is the only
  dependency), so it needs no `server-only` or `"use server"` marker.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Mirror created (pre-existing gap) | Devin |
