# src/migrations.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Two contracts in one suite: `MIGRATION_JOURNAL_ENTRIES` mirrors
`drizzle/meta/_journal.json` (`{tag, when}` projection — journal `idx`/
`version`/`breakpoints` are intentionally not embedded), and
`listPendingMigrations` maps stubbed executor states: missing table → all
pending, partial `created_at` set → only unapplied tags, complete → none.

## Important Notes

- The missing-table path relies on the executor throwing — the repository
  function swallows that error into all-pending, other errors rethrow (the
  stub throws a generic Error for the missing-table case).
- `createdAt` values are passed as both `number` and `string` — the real
  column is bigint and drivers differ on the JS type, so the comparison
  goes through `Number()`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for the /setup readiness checklist (WP3) | Devin |
