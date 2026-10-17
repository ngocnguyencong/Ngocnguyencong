# packages/db/src/analytics-events.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Unit tests for `createDrizzleAnalyticsEventRepository` using a fake
`PostgresJsDatabase` (captured `insert().values()` payloads + queued
`execute()` results).

## What It Does

- Asserts inserts write normalized rows (bounded fields trimmed, null defaults).
- Asserts `summarizeSiteTraffic` issues both aggregate queries (totals +
  top paths), clamps limits, and coerces counts to numbers.
- Asserts validation rejects bad ids, kinds, and oversized fields.

## Dependencies

- `vitest`, `./analytics-events`, fake-db test harness conventions from
  the neighboring `usage-counters` tests.

## Important Notes

- Pure unit tests — no live database; see
  `analytics-events.integration.test.ts` for the schema round-trip.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Bounded-field trim-on-insert coverage | Devin |
| 2026-10-10 | Initial coverage for record + summarizeSiteTraffic | Devin |
