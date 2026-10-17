# apps/web/src/push.test.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Unit tests for the Expo push sender — `vi.mock("server-only")` plus a
fake injected `fetch`; no network and no database.

## What It Does

- `isSendablePushToken` — real `ExponentPushToken[...]` everywhere;
  dev strings only under `local`/`test` `APP_ENV`.
- `sendExpoPush` — 100-per-request chunking (250 → 3 calls), ticket ↔
  token receipts, non-Expo tokens skipped pre-send, `channelId`/`data`
  forwarding. A mid-sequence failing chunk (500) is collected into
  `failed` and logged through an injected `logger` while the remaining
  chunks still send; a malformed `{data}` payload behaves the same; an
  invalid message list still throws. Authorization coverage: an injected
  `accessToken` sends `Authorization: Bearer <token>`; the env default
  (`EXPO_ACCESS_TOKEN`) and the no-token case are exercised through
  `vi.stubEnv` + `vi.resetModules` + dynamic re-import because
  `serverConfig` parses once at module load (`fakeFetch` records
  per-call headers).
- `sendUserPush`/`sendWorkspacePush` — a stub `PushTokenRepository`
  verifies scoped listing, android channel assignment, `failed` counts
  in the delivery result, and that only `DeviceNotRegistered` receipts
  are pruned via `removeTokens`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | +coverage: ok-ticket `push_ticket` recording (injected `PushTicketRepository`), immediate `DeviceNotRegistered` token pruning, internal `userId` message metadata never serialized into the Expo POST body | Devin |
| 2026-10-12 | `fakeFetch` captures request headers; +3 `Authorization: Bearer` cases (injected token, `EXPO_ACCESS_TOKEN` env default via stubEnv/re-import, absent header) | Devin |
| 2026-10-11 | Chunk-failure collection + logger assertions replace throw expectations | Devin |
| 2026-10-10 | Created for Expo push notifications | Devin |
