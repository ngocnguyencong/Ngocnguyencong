# apps/web/src/mobile-push-tokens-route.test.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Route plumbing tests for `app/api/mobile/push-tokens/route.ts` — the
`./mobile-push-tokens` module is mocked with a stub BFF so only the
HTTP delegation/JSON mapping is exercised (mirrors
`mobile-entitlement-route.test.ts`).

## What It Does

- `GET` delegates to `bff.list(headers)` and maps `{body, status}`.
- `POST` forwards the parsed JSON body; malformed JSON degrades to `{}`.
- `DELETE` forwards `{token}` and maps the `removed` payload.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Created for Expo push notifications | Devin |
