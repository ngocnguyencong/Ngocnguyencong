# app/api/analytics/collect/route.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

First-party analytics ingest endpoint — `POST /api/analytics/collect`,
active only under `ANALYTICS_PROVIDER=local`. The consent-gated
`AnalyticsBeacon` sends pageviews/events here via `sendBeacon`/
keepalive-fetch.

## What It Does

- 404s for every non-`local` provider — the route pretends not to exist
  and never reveals the configured mode.
- Rate-limits per trusted client IP via `analyticsCollectLimiter` +
  `rateLimitResponse` (fail-open telemetry bucket).
- Reads the JSON body through `readBoundedJson` (≤2 KB — larger payloads
  413, unparseable 400).
- Validates with `parseAnalyticsCollectBody` → 400 on any contract miss.
- Records via `recordAnalyticsEvent` → 204, no body, `no-store` +
  `x-robots-tag: noindex` headers on every response.
- Unhandled insert failures → `serverObservability.captureException` +
  generic 500.

## Dependencies

- `../../../../src/analytics` (parser + recorder + provider check),
  `../../../../src/rate-limit-runtime` `analyticsCollectLimiter`,
  `../../../../src/rate-limit-route` `rateLimitResponse`,
  `../../../../src/request-body` `readBoundedJson`,
  `../../../../src/observability-runtime`.

## Important Notes

- `force-dynamic` + `nodejs` runtime; POST is the only export so other
  verbs 405 automatically.
- Sets no cookies and stores no raw IP or user-agent — identity is the
  daily-rotating salted `visitorHash` computed server-side.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Initial endpoint (local provider only) | Devin |
