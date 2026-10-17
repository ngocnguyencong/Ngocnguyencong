# src/push/deep-links.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Notification-tap deep-link decision logic — pure and expo-free, so
vitest covers the whole extract → validate → map pipeline (the same
split as `register.ts` vs `expo.ts`).

## What It Does

- `extractNotificationHref(response)` — reads
  `notification.request.content.data.href` off an
  `expo-notifications` `NotificationResponse`-shaped value,
  record-guarding every level; returns the raw string or `null`.
- `resolveNotificationRoute(href)` — validates a payload href and
  resolves it to a `router.push`-able path, `null` to ignore the tap.
  Only absolute in-app paths pass: non-strings, empty/whitespace-only,
  over `MAX_HREF_LENGTH` (512), leading-`//` or interior `//`,
  backslashes, whitespace/control chars, and `..` segments all reject —
  the leading `/` already excludes `javascript:`/`https:`/authority
  forms. `?`/`#` suffixes survive; trailing slashes normalize.
- `WEB_HREF_TO_MOBILE_ROUTE` — server hrefs name the WEB route tree;
  the map rewrites the ones whose mobile screens moved (`/billing` →
  `/settings/billing`, `/dashboard` → `/home`) or don't exist on mobile
  (`/ai` → `/settings/billing` — the only `/ai` sender is the AI-budget
  alert, so it lands where plan/quota lives). Identically-named paths
  (`/settings/members`, `/settings/connections`, `/notifications`)
  pass through unchanged.
- `routeForNotificationResponse(response)` — the full pipeline the
  `expo.ts` listener calls per tap.

## Important Notes

- The web push sender attaches `data: { href }` when the notification
  row has one; rows without hrefs produce plain taps that resolve
  `null` and are ignored.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | Map `/ai` → `/settings/billing` — budget-alert href previously passed through to a nonexistent mobile route | Devin |
| 2026-10-12 | Created for notification-tap deep links | Devin |
