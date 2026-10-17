# scripts/supabase-doctor.mjs

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`pnpm supabase:doctor [--fix-rls]` — connects via `DATABASE_URL` (postgres
resolved from `packages/db` deps) and reports: server version, SSL state,
pooler mode vs prepared-statement handling, Drizzle journal vs
`drizzle.__drizzle_migrations` pending count, and `public`-schema tables
exposed via PostgREST (RLS disabled or anon/authenticated grants) with
exact fix SQL. `--fix-rls` applies `ALTER TABLE … ENABLE ROW LEVEL
SECURITY` + `REVOKE ALL … FROM anon, authenticated` in one transaction;
warns when the connecting role is not the table owner. Checks
`STORAGE_ENDPOINT` reachability when set. Exits non-zero on failures.

## Exported pure helpers (tested in tests/supabase-doctor.test.ts)

`parseArgs`, `assessPooler`, `computePendingMigrations`, `rlsRiskReport`,
`checkStorageEndpoint`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial script (phase B4) | Devin |
