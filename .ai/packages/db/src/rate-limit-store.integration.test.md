# packages/db/src/rate-limit-store.integration.test.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Real-Postgres integration tests for `rate-limit-store.ts`, gated on
`TEST_DATABASE_URL` exactly like `postgres.integration.test.ts`
(`describe.skip` when unset; `beforeAll` migrates from `../drizzle`).

## What It Does

- Increments within a 60s window (counts 1,2,3), then verifies rollover after
  `now + 60_001` resets count to 1 with the new `window_start` persisted.
- 20 concurrent `hit()` calls on one key return exactly counts {1..20} —
  proves the upsert is atomic under parallel connections.
- `pruneExpiredRateLimitBuckets` removes only expired rows and returns the
  deleted count.
- Each test cleans up its own `test_rate_limit_*` keys in `finally`.

## Important Notes

- Requires migration 0006 applied via the committed `drizzle/` folder — run
  with `TEST_DATABASE_URL=postgres://supastack:supastack@localhost:5432/<db>`.
- `createPostgresDatabase({ maxConnections: 10 })` for the concurrency test so
  the pool can actually run hits in parallel.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created (Task 4, feat/prod-ready-kit) | Devin |
