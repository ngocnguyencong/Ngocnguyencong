# apps/web/src/mobile-push-tokens.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

`server-only` Drizzle/session wiring for `/api/mobile/push-tokens` —
binds `createMobilePushTokensBff` to the real database, auth session,
and active-workspace resolution. Mirrors `mobile-feature-board.ts`.

## What It Does

- `mobilePushTokensBff` — the assembled instance the route file calls.
- Deps: `getSession` → `getAuthSession(headers)`;
  `resolveWorkspace` → `resolveMobileWorkspaceContext` — the same
  membership-verified resolver every other mobile BFF uses, so a forged
  or stale active-workspace cookie can't stamp tokens onto a foreign or
  removed workspace (null → 404 `noWorkspace`);
  `register`/`unregister`/`listForUser` → a module-scoped
  `createDrizzlePushTokenRepository(database)`.
- Row → `MobilePushToken`: `lastSeenAt` → ISO string, unknown platform
  strings collapse to `"android"`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `resolveWorkspace` now uses membership-verified `resolveMobileWorkspaceContext` (was raw cookie/preference resolution) | Devin |
| 2026-10-10 | Created for Expo push notifications | Devin |
