# src/theme/appearance-sync.tsx

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

`AppearanceSync` — the null-rendering client component that syncs the
signed-in user's appearance with `/api/account/appearance`. Mounted inside
`WorkspaceShell` (app chrome only — marketing pages never call the API;
the desktop Tauri webview inherits it for free).

## Important Notes

- On mount it GETs the server snapshot: server prefs + (no local stamp OR
  server `updatedAt` > local stamp) → `applyAppearanceSnapshot`; else a
  newer local stamp (or empty server row) → PUT `readAppearanceSnapshot()`.
- `supastack:appearance-change` events debounce ~800ms into a PUT; a
  successful PUT adopts the returned `updatedAt` as the local stamp.
- Best-effort everywhere: fetch failures, non-OK responses, and offline
  (`navigator.onLine === false` gates boot + pushes) are all silent — no
  toast, no throw, never blocks navigation.
- The conflict rule is timestamp-only; both sides trust the
  `supastack-appearance-updated-at` localStorage stamp.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Created for cross-device appearance sync (WP1) | Devin |
