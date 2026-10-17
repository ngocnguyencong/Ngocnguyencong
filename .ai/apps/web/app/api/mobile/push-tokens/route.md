# apps/web/app/api/mobile/push-tokens/route.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

`/api/mobile/push-tokens` — device push token management for the Expo
app, delegating to `mobilePushTokensBff` like the other mobile BFF
routes (`runtime = "nodejs"`).

## What It Does

- `GET` → `{data: {tokens}}` — the caller's registered tokens
  (`id`, `platform`, `lastSeenAt`).
- `POST` `{token, platform}` — registers (upserts) the token under the
  session user + active workspace → `{data: {token}}`; 401/404/422 via
  the BFF. Malformed JSON degrades to empty input → 422.
- `DELETE` `{token}` — removes the caller's own token →
  `{data: {removed}}`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Created for Expo push notifications | Devin |
