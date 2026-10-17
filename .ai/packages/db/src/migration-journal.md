# src/migration-journal.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Embedded copy of `drizzle/meta/_journal.json` entries (`tag` + `when`
only) consumed by `migrations.ts` `listPendingMigrations`. The package
tsconfig roots at `src/`, so the JSON cannot be imported directly — the
entries are inlined here instead.

## Important Notes

- REGENERATE, don't hand-edit: produced from the journal after every
  `db:generate`; `migrations.test.ts` fails when this drifts from
  `drizzle/meta/_journal.json` — update the file in the same change that
  adds a migration.
- Only `tag`/`when` are copied — `idx`/`version`/`breakpoints` are
  drizzle-internal and unused by the pending-migration comparison.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for the /setup readiness checklist (WP3) — 20 entries, 0000_init..0019_famous_magus | Devin |
