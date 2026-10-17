# apps/web/src/push-receipts.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Expo push *receipt* reconciliation (`import "server-only"`): POSTs
recorded `push_ticket` ids to
`https://exp.host/--/api/v2/push/getReceipts`, prunes tokens whose
delivery failed as `DeviceNotRegistered`, and clears reconciled/expired
tickets. Registered as the `push.receipts` platform job
(`job-handlers.ts`) on a 30-minute `PLATFORM_SCHEDULES` cadence.

## What It Does

- `reconcilePushReceipts(deps, now)` → `{checked, pruned, expired,
  failedChunks}`:
  - `listDue(now - 15min, 1000)` — younger tickets may not have a
    receipt yet; the batch is capped so one run stays bounded.
  - One receipts POST per `EXPO_RECEIPT_CHUNK_SIZE` (300) ids with the
    same Accept/Content-Type headers as sends plus
    `Authorization: Bearer` when `EXPO_ACCESS_TOKEN` resolves
    (`accessToken` dep → `serverConfig.expo.accessToken`).
  - `details.error === "DeviceNotRegistered"` receipts collect tokens
    for `tokenRepository.removeTokens` — all other receipt errors leave
    the token row alone.
  - Every ticket that received a receipt (ok or error) is deleted via
    `remove`; leftovers older than 24h are swept via `removeOlderThan`
    regardless.
  - A failed chunk (transport/non-2xx/malformed `{data}`) logs through
    the injected/lazy `serverObservability.logger` and the loop
    continues — the count lands in `failedChunks`. Tokens are never
    logged.

## Dependencies

- **Internal:** `@supastack/db` `PushTicketRepository` (injected),
  `PushReceiptTokenRepository` (`removeTokens`), `./push`
  `ExpoPushFailureLogger`, `./observability-runtime` (lazy dynamic
  import like `push.ts`).
- **External:** `server-only`, `@supastack/config` `parseServerConfig`
  (`expo.accessToken` default), global `fetch` (injectable for tests).

## Important Notes

- Receipt `status` other than `"ok"` is treated as an error receipt —
  only `DeviceNotRegistered` prunes; `MessageRateExceeded` et al. keep
  the token.
- `readReceiptMap` accepts any `{data: {<ticketId>: receipt}}` shape;
  non-object entries are skipped.

## Known limits

- Reconciliation is cron-cadence — a token invalidated at delivery is
  pruned on the next run, not at send time.
- Tickets whose chunk never gets a response survive until the 24h sweep;
  the tokens they targeted stay until then.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for Expo push receipt reconciliation (WP6) | Devin |
