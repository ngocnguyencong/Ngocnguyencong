# src/analytics.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Server-only analytics composition root (`import "server-only"`): resolves
`ANALYTICS_PROVIDER` from `parseServerConfig`, validates + records events
for the local provider, and loads the admin 30-day site-traffic summary.

## What It Does

- `resolveAnalyticsProvider()` → `off | local | plausible | posthog`.
- `resolveAnalyticsConfig()` → discriminated `ResolvedAnalytics` (siteId +
  optional host for the script providers).
- `parseAnalyticsCollectBody(value)` → validates the collect payload:
  `kind` pageview|event, bounded `name` ≤120 / `path` ≤512 /
  `referrerHost` ≤255, paths must be site-relative (`/…`), pageviews
  require a path, events require a name, referrer normalized to a bare
  host. Every string field rejects control characters
  (`hasControlCharacters` — C0 + DEL; Postgres varchar rejects NUL →
  would 500).
- `hashVisitorIdentity({ ip, userAgent, secret, date })` →
  `createHmac("sha256", secret)` over `JSON.stringify([ip, ua, date])` —
  the only stored identity; the UTC date rotates it daily and the JSON
  array keeps fields unambiguous (no concatenation collisions).
- `recordAnalyticsEvent({ …, requestHeaders }, deps?)` → derives the
  trusted client IP via `clientIpForRequest` (`TRUSTED_PROXY_COUNT`
  XFF-tail rule), HMACs ip+ua+date under AUTH_SECRET, inserts through the
  repository with `workspaceId: null` (public events can never be
  attributed to a workspace).
- `loadSiteAnalyticsSummary(days = 30)` → `SiteAnalyticsSummary`
  (pageviews, events, distinct visitor hashes, top-10 paths).
- `deps` (`repository`, `now`, `secret`, `trustedProxyCount`) make every
  path injectable for tests.

## Dependencies

- `@supastack/config` `parseServerConfig`; `@supastack/db`
  `createDrizzleAnalyticsEventRepository` + types; `./auth-runtime`
  `database`; `./rate-limit` `clientIpForRequest`; `./rate-limit-runtime`
  `trustedProxyCount`; `node:crypto`.

## Important Notes

- Raw IP and user-agent are request inputs only — folded into
  `visitorHash`, never persisted or logged.
- The secret defaults to `serverConfig.auth.secret` (AUTH_SECRET);
  rotating it re-keys every visitor.
- The Drizzle repository is created lazily at module scope against the
  shared `database` — tests inject fakes instead.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Visitor hash → keyed HMAC over `JSON.stringify([ip, ua, date])`; collect fields reject control chars (`hasControlCharacters`) | Devin |
| 2026-10-10 | Initial module: provider resolution, body parser, salted daily-rotating visitor hash, admin summary loader | Devin |
