# packages/db/src/postgres.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Postgres lifecycle: `createDatabaseLifecycle` (dep-injected, testable)
and `createPostgresDatabase` (postgres.js + drizzle). Includes
`postgresClientOptions(databaseUrl, env)` — disables `prepare` when the
URL targets a transaction pooler (port 6543, `?pgbouncer=true`, or
`DATABASE_POOLER=transaction`) because Supavisor/pgbouncer cannot hold
prepared statements; `sslmode` stays in the URL untouched.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | `postgresClientOptions` pooler handling (phase B4) | Devin |
