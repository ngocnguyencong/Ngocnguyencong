# packages/db/src/push-tokens.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Drizzle repository for `device_push_token` (migration 0015) — the Expo
push tokens a signed-in user's devices register, scoped by `workspaceId`
like every user-owned record. Backing store for the mobile
`/api/mobile/push-tokens` BFF and the server-side Expo push sender.

## What It Does

- `createDrizzlePushTokenRepository(db, deps?)` — `deps` optionally inject
  `createId` (default `dpt_${randomUUID()}`) and `now` (default
  `new Date()`) for deterministic tests.
- `register({userId, workspaceId, token, platform})` — a single
  `INSERT … ON CONFLICT (token) DO UPDATE` upsert keyed on the unique
  `token` index: a reinstall or account switch re-points the same token
  row at the registering user/workspace and bumps `last_seen_at` instead
  of duplicating devices. Then enforces `MAX_PUSH_TOKENS_PER_USER` (20):
  the user's other tokens are ranked `last_seen_at` DESC and everything
  past `MAX - 1` is deleted — the upserted token itself is never evicted
  by its own call. Returns the row.
- `unregister({userId, token})` — `DELETE … WHERE token = ? AND
  user_id = ?`; deletes only when the token row belongs to the caller.
- `listForUser(userId)` / `listForWorkspace(workspaceId)` — scoped reads,
  `created_at` ascending, bounded at `PUSH_TOKEN_LIST_LIMIT` (500).
  `listForUsers(userIds)` — the same scoped read over an id list.
- `removeTokens(tokens)` — `DELETE … WHERE token IN (…)` for pruning the
  tokens the Expo push API reports as `DeviceNotRegistered`; returns the
  removed count. `listForUsers`/`removeTokens` skip the query entirely on
  empty input.
- `DEVICE_PUSH_PLATFORMS` / `isDevicePushPlatform` — the `"android" |
  "ios" | "web"` platform contract shared by the BFF validator.

## Dependencies

- **External:** `drizzle-orm` (`and`/`asc`/`eq`/`inArray` query builder +
  `PostgresJsDatabase`), `node:crypto` `randomUUID`.
- **Consumers:** `apps/web/src/mobile-push-tokens.ts` (BFF wiring),
  `apps/web/src/push.ts` (delivery + pruning), exported via
  `packages/db/src/index.ts`.

## Important Notes

- Input normalization throws on blank user/workspace ids, blank or >255
  tokens, and non-enum platforms before any query runs — validation
  errors are programmer errors, not database errors. `normalizeToken`
  trims first and stores the trimmed value, so direct callers can't
  persist padded tokens.
- There is no workspace-scoped delete path beyond `unregister` (caller-
  owned token) and `removeTokens` (server pruning by token value);
  cascade deletes on user/workspace removal come from the schema FKs.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Per-user cap (20, oldest-`lastSeenAt` pruned on register), 500-row list bounds, trimmed-token persistence | Devin |
| 2026-10-10 | Created for Expo push notifications | Devin |
