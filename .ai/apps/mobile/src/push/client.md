# src/push/client.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

`/api/mobile/push-tokens` typed wrapper over `MobileApiClient`, the
same pattern as `notifications/client.ts` and `workspaces/client.ts`.

## What It Does

- `list()` — `GET` → `{data: {tokens}}` → `MobilePushToken[]`
  (`id`, `platform`, `lastSeenAt`); malformed payloads throw.
- `register({platform, token})` — `POST` → `{data: {token}}`.
- `unregister(token)` — `DELETE` `{token}` body.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Created for Expo push notifications | Devin |
