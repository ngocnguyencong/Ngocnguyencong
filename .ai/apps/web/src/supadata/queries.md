# apps/web/src/supadata/queries.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Read layer over raw sql: resolveRange, overview, timeseries, realtime (5-min window), breakdown (revenue-correlated by dimension class: payment dims direct-join, geo/device via visitor, page/event via touched visitors), visitors+visitorDetail, funnelResults (ordered prefix counts), goalStats, revenueAttribution, mrrSeries, revenueSummary, payments, mentions, keywords.

## Important Notes / NEVER Change

- postgres.js rejects Date params in raw sql — always `.toISOString()`.
- GROUP BY must include `e.site_id` for the correlated revenue subqueries.
- mrrSeries = daily aggregate → cumulative window (never window-over-group).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
