# apps/web/src/mobile-push-tokens-bff.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Pure dependency-injected BFF for `/api/mobile/push-tokens` — the
auth/workspace/validation boundary, independent of Next, Better Auth, or
Drizzle so it runs under vitest. Mirrors `mobile-feature-board-bff.ts`.

## What It Does

- `createMobilePushTokensBff(deps)` → `{list, register, unregister}`,
  each returning `{body, status}` (`{data: …}` or `{error: {code,
  message}}`).
- Shared context: `deps.getSession(headers)` → 401 `unauthorized` — every
  operation requires a session, resolved once per request.
- Only `register` also resolves `deps.resolveWorkspace(userId)` (404
  `noWorkspace`) — token rows are stamped with a workspace, and the wired
  resolver verifies membership, so a forged/stale active-workspace cookie
  fails instead of writing under a foreign workspace.
- `list` → `deps.listForUser(user.id)` (`{id, platform, lastSeenAt}`
  ISO strings) — user-scoped, no workspace needed.
- `register` — session + verified workspace, then validates `platform` ∈
  ios|android|web and `token` non-empty ≤255 (422 `invalidInput`), then
  `deps.register` under the session user + resolved workspace → 201
  `{data: {token}}`.
- `unregister` — validates `token`, `deps.unregister({token, userId})`
  → 200 `{data: {removed}}`; the repository scopes the delete to
  `{token, session.user.id}`, so it works even when the account has no
  resolvable workspace.
- Unexpected dependency throws → 500 `internalError`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Workspace resolution narrowed to `register` only; `list`/`unregister` are session-scoped (no more 404 on workspace-less accounts) | Devin |
| 2026-10-10 | Created for Expo push notifications | Devin |
