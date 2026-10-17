# src/usage-caps.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

SQL-capture contract tests for `createDrizzleUsageCapRepository`, following
the `user-appearance.test.ts` / `usage-counters.test.ts` pattern: a stub
database records the Drizzle-built statements so scope filters, upsert
shape, and validation can be asserted without a live database.

## Important Notes

- The `(workspace_id, key)` composite primary key does not mark each column
  `.primary === true` in Drizzle table metadata — the test inspects the
  table's composite PK definition instead of per-column flags.
- Covers `list` ordering by key, `get` returning `null` when no row exists,
  `set` upserting on the PK, `clear` deleting by scope, and the
  workspaceId/key/cap validation errors.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
