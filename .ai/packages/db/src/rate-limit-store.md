# packages/db/src/rate-limit-store.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Shared Postgres fixed-window rate-limit store on `rate_limit_bucket`
(migration 0006). Every app replica counts hits against the same rows, so
limits hold across instances.

## What It Does

- `createPostgresRateLimitStore(db)` → `{ hit(key, windowMs, now) }`: a single
  atomic `INSERT ... ON CONFLICT (key) DO UPDATE` that increments `count`
  inside the live window or rolls `window_start`/`expires_at` forward once
  `expires_at <= now`. Returns `{ count, expiresAt }`.
- `pruneExpiredRateLimitBuckets(db, now)` → `DELETE ... WHERE expires_at <=
  now`, returns deleted row count (`.count` on the postgres.js `RowList`).

## Public API

- `RateLimitHit = { count: number; expiresAt: Date }`
- `RateLimitStore = { hit(key, windowMs, now): Promise<RateLimitHit> }`
- `createPostgresRateLimitStore(database: PostgresJsDatabase<typeof schema>)`
- `pruneExpiredRateLimitBuckets(database, now): Promise<number>`

## Dependencies

- `drizzle-orm` `sql` template + `PostgresJsDatabase` (typed on `typeof schema`,
  same alias as `postgres.ts`).
- Consumed by `apps/web/src/rate-limit-runtime.ts` when
  `serverConfig.rateLimit.store === "postgres"`.
- `pruneExpiredRateLimitBuckets` runs hourly via the `platform:rate-limit.prune`
  schedule (`apps/web/src/scheduler-runtime.ts`) → `rate-limit.prune` handler
  (`apps/web/src/job-handlers.ts`).

## Important Notes / NEVER Change

- **Raw `execute` params cannot carry `Date` objects** — drizzle passes them
  unserialized into postgres.js's prepared `Bind` path, which throws
  `ERR_INVALID_ARG_TYPE`. Always send timestamps as `toISOString()` strings
  with explicit `::timestamptz` casts.
- `RETURNING expires_at` arrives as a raw string (raw execute skips type
  parsers) — normalized to `Date` before returning.
- Keys arrive already namespaced (`${limiterName}:${callerKey}`) — the store
  is dumb about key shape; `createStoreRateLimiter` owns namespacing.
- Fail-open is NOT here — callers (`createStoreRateLimiter`) own that policy.

## Open Threads

None.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Cleared stale open thread — `rate-limit.prune` schedule/handler wired | Devin |
| 2026-09-23 | Created for shared Postgres rate limiting (Task 4, feat/prod-ready-kit) | Devin |
