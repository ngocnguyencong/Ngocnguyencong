# src/migrations.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

`listPendingMigrations(database)` — journal tags from
`MIGRATION_JOURNAL_ENTRIES` not yet recorded in
`drizzle.__drizzle_migrations` (matched on `created_at` ↔ `entry.when`).
Powers the /setup "Migrations applied" check.

## Important Notes

- A MISSING migrations table returns every bundled tag — a database that
  was never migrated is all-pending, same convention as
  `scripts/supabase-doctor.mjs` `computePendingMigrations`.
- Any OTHER read error (permissions, connection) rethrows — the caller
  (`setup-readiness-runtime.ts`) maps that to the "Could not read
  migration state" action row instead of misreporting all-pending.
- `Pick<PostgresJsDatabase, "execute">` keeps the signature callable from
  tests with a stub executor.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for the /setup readiness checklist (WP3) | Devin |
