# src/analytics.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Unit tests for `src/analytics.ts` — provider resolution, collect-body
validation, visitor hashing, event recording, and the admin summary
loader, all against injected fake repositories.

## What It Does

- `resolveAnalyticsProvider`/`resolveAnalyticsConfig` for each
  `ANALYTICS_PROVIDER` mode (mocked server config).
- `parseAnalyticsCollectBody`: kind enum, length bounds, site-relative
  paths, pageview-requires-path / event-requires-name, referrer
  normalization (full URL → host, non-host rejected), control-character
  (`\x00`/`\x1F`/`\x7F`) rejection in path/name/referrer.
- `hashVisitorIdentity`: locked to `createHmac("sha256", secret)` over
  `JSON.stringify([ip, ua, date])` — split-field inputs that would
  collide under naive concatenation stay distinct.
- `recordAnalyticsEvent`: inserts exactly one row, `visitorHash` is
  64-char hex, hash ≠ raw ip/ua, `workspaceId` stays null, same ip+ua on
  different dates produce different hashes.
- `loadSiteAnalyticsSummary`: 30-day window math, day clamping, fake
  repository plumbing.

## Dependencies

- `vitest`, `./analytics`, `@supastack/db` types for the fake repository.

## Important Notes

- `deps.secret` keeps hashing deterministic without touching real config;
  `deps.now` pins the UTC-date rotation boundary.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | HMAC-construction lock + adjacent-field split case; control-char rejection cases in path/name/referrer | Devin |
| 2026-10-10 | Initial coverage (12 tests) | Devin |
