# apps/web/src/push.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Server-side Expo push sender (`import "server-only"`): POSTs messages to
`https://exp.host/--/api/v2/push/send` and delivers pushes to a user's or
workspace's registered `device_push_token` rows, pruning tokens Expo
reports as `DeviceNotRegistered`.

## What It Does

- `sendExpoPush(messages, {fetch?, environment?, accessToken?, logger?})`
  — chunks at ≤100 (`EXPO_PUSH_CHUNK_SIZE`), one POST per chunk, returns
  `{receipts, skipped, failed}`. Each receipt zips a parsed ticket back
  to its token. A failed chunk (transport error, non-2xx, malformed
  `{data}` payload) lands in `failed` and is logged through the
  structured logger — it never abandons the remaining chunks and is
  never retried. An invalid message list still throws up front. When
  `accessToken` resolves (`EXPO_ACCESS_TOKEN` →
  `serverConfig.expo.accessToken`, overridable per call) every POST
  carries `Authorization: Bearer <token>` — the token is never logged.
- `sendUserPush(userId, {title, body, data?}, deps?)` /
  `sendWorkspacePush(workspaceId, …)` — resolve rows via the repository
  (`listForUser` / `listForWorkspace`, both bounded at
  `PUSH_TOKEN_LIST_LIMIT`), send, then `removeTokens` every receipt
  whose `details.error === "DeviceNotRegistered"`. Returns
  `{sent, skipped, failed, pruned, receipts}`. Android rows also get
  `channelId: "default"` (the channel the mobile app creates). Every
  `ok` ticket with an `id` is recorded as a `push_ticket` row via the
  injected `PushTicketRepository` (production default
  `createDrizzlePushTicketRepository`) so `push-receipts.ts` can
  reconcile delivery later — the internal `userId` rides the in-memory
  message shape only and is stripped before the Expo POST.
- `isSendablePushToken(token, environment)` — only
  `^ExponentPushToken\[[\w-]+\]$` reaches the network; any other
  non-empty string is allowed only when the app environment is
  `local`/`test` (dev tokens). `environment` defaults to
  `serverConfig.app.environment` — `parseServerConfig` applies the
  `NODE_ENV=production` → `APP_ENV` preprocessing, so bare production
  hosts can't leak dev tokens.

## Dependencies

- **Internal:** `@supastack/db` `createDrizzlePushTokenRepository` /
  `createDrizzlePushTicketRepository` + their repository interfaces;
  `./auth-runtime` `database` and
  `./observability-runtime` `serverObservability.logger` are both loaded
  lazily (dynamic import) so tests and non-push/failure paths never pull
  the auth or observability graphs. `logger` is injectable as
  `ExpoPushFailureLogger` (`{error(message, context?)}`).
- **External:** `server-only`, `@supastack/config` `parseServerConfig`
  (`app.environment` + `expo.accessToken` defaults, both injectable),
  global `fetch` (injectable for tests — never call the network in tests).

## Important Notes

- The notification fan-out calls this per user inside an existing
  try/catch (`notification-emit.ts` `sendPush` dep) — delivery stays
  best-effort, and per-chunk failures now additionally surface through
  `serverObservability.logger.error` (`"Expo push chunk delivery
  failed."` + `{chunkSize, error}` context — a static message, no token
  values or URLs).
- Ticket indexes align 1:1 with the sent chunk, so receipts map straight
  back to tokens for pruning without matching on response content.

## Known limits

- Receipt reconciliation lives in `push-receipts.ts` on a 30-minute
  platform schedule — send tickets `ok`-at-send can still fail at
  delivery and are only pruned on the next reconciliation pass.
- Notification fan-out sends `sendUserPush` per recipient sequentially
  inside `notification-emit.ts` — there is no batched fan-out job, so a
  large workspace emits one Expo request per user per notification.
- Involuntary session loss can't unregister — the DELETE needs a live
  session cookie, so an expired/revoked session leaves the token row
  until the server prunes it as `DeviceNotRegistered` or the user
  re-registers elsewhere.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | `ok` send tickets recorded to `push_ticket` for receipt reconciliation; internal `userId` threads through `ExpoPushMessage` (stripped before the Expo POST); `getReceipts` known-limit removed — `push-receipts.ts` now reconciles on a schedule | Devin |
| 2026-10-12 | `EXPO_ACCESS_TOKEN` support: `accessToken` dep defaulting to `serverConfig.expo.accessToken` adds `Authorization: Bearer` to every Expo POST (never logged) | Devin |
| 2026-10-12 | `EXPO_ACCESS_TOKEN` → `Authorization: Bearer` on Expo sends (optional `accessToken` dep, `serverConfig.expo.accessToken` fallback); deep-links known-limit removed — mobile now routes `data.href` notification taps into screens | Devin |
| 2026-10-11 | `serverConfig.app.environment` replaces raw `APP_ENV` read; per-chunk failure tolerance + observability logging + `failed` result fields; Known limits documented | Devin |
| 2026-10-10 | Created for Expo push notifications | Devin |
