# packages/db/src/analytics-events.integration.test.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Live-database integration test for the analytics-events repository:
inserts real `analytics_event` rows through
`createDrizzleAnalyticsEventRepository` and reads the summary back.

## What It Does

- Skips unless `RUN_DB_INTEGRATION=1` + a test database URL are set
  (same gating convention as the other `*.integration.test.ts` files).
- Verifies insert → summary round-trip against real Postgres.

## Dependencies

- `vitest`, `drizzle-orm` postgres-js driver, `./analytics-events`.

## Important Notes

- Requires a migrated local Postgres; CI/dev opt-in only — never runs
  against a production database.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Initial integration coverage | Devin |
