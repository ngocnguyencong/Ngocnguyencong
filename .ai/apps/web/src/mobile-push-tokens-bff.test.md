# apps/web/src/mobile-push-tokens-bff.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Unit tests for `createMobilePushTokensBff` with deterministic injected
deps — the mobile route-test pattern.

## What It Does

- `list` — 401 without a session; workspace-less accounts still list
  (`resolveWorkspace` is never consulted); caller-scoped token list on
  the happy path.
- `register` — 401 without a session; 404 `noWorkspace` when the active
  workspace resolves null (the foreign/stale-cookie case — `deps.register`
  is never reached); 422 for missing/invalid platform or token (blank,
  >255, wrong types); asserts `deps.register` receives `{platform, token,
  userId, workspaceId}` from the session + resolved workspace; 201 on
  success.
- `unregister` — 401 without a session; 422 on missing token; deletes
  without a workspace (`resolveWorkspace` never consulted) scoped to
  `{token, session.user.id}` and surfaces `removed`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Session-vs-workspace coverage: register keeps the 404, list/unregister drop it | Devin |
| 2026-10-10 | Created for Expo push notifications | Devin |
