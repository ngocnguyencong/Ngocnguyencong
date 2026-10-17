# packages/db/src/analytics-events.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

`analytics_event` repository: the write + read seam behind the local
analytics provider. Exposes the `AnalyticsEventRepository` contract
(`record` + `summarizeSiteTraffic`) and the Drizzle implementation
`createDrizzleAnalyticsEventRepository`.

## What It Does

- `record(event)` normalizes and inserts one `AnalyticsEventRecord`
  (`id`, `kind` pageview|event, optional bounded `name`/`path`/
  `referrerHost`/`visitorHash`, nullable `workspaceId`). `optionalBounded`
  trims accepted string fields before they reach the row.
- `summarizeSiteTraffic({ since, limit })` aggregates platform-level
  (`workspace_id IS NULL`) rows since a timestamp: pageview + event
  totals, `count(DISTINCT visitor_hash)` uniques, and the top `limit`
  pageview paths (limit clamped 1–100).

## Dependencies

- `drizzle-orm` (`sql` tagged queries) + `PostgresJsDatabase`.
- `./schema` `analyticsEvent` table.

## Important Notes

- Privacy boundary lives here by type: the record has `visitorHash`, never
  ip/userAgent fields — raw IP/user-agent cannot be persisted through this
  repository.
- Validation throws (not silently drops) on oversized fields so callers
  get the same contract as the collect route's parser.
- Anonymous marketing rows keep `workspaceId: null`; workspace-scoped
  inserts are possible for signed-in product events but the summary query
  only reads platform-level rows.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `optionalBounded` returns `value.trim()` — bounded fields insert trimmed | Devin |
| 2026-10-10 | Initial repository: `record` + `summarizeSiteTraffic` (30-day admin card source) | Devin |
