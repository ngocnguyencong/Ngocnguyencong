# src/push/deep-links.test.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Unit tests for `push/deep-links.ts` — structural `NotificationResponse`
fixtures only, no native modules.

## What It Does

- Extract: `data.href` read-through; missing/non-record `data`,
  non-string hrefs, and malformed responses at every nesting level all
  return `null`.
- Resolve: internal paths pass through (`/notifications`,
  `/settings/members`, `/chat/[id]`, `/`); web-only paths rewrite
  (`/billing` → `/settings/billing`, `/dashboard` → `/home`,
  `/ai` → `/settings/billing`); query + hash suffixes and
  trailing-slash normalization covered.
- Rejects: non-strings, empty/whitespace, external + `javascript:` +
  `data:`/`mailto:` schemes, protocol-relative `//host`, backslashes,
  interior `//`, interior whitespace/control chars, `..` segments, and
  >512-length payloads.
- End-to-end: `routeForNotificationResponse` on a full response maps
  `/billing` → `/settings/billing`; unsafe/missing hrefs and garbage
  responses resolve `null`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | Cover the `/ai` → `/settings/billing` budget-alert mapping | Devin |
| 2026-10-12 | Created alongside deep-links.ts | Devin |
