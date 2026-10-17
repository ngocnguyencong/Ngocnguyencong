# drizzle/0019_famous_magus.sql

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Drizzle migration creating `workspace_usage_cap` — owner/admin-set
per-meter usage ceilings backing Settings → Usage.

## Important Notes

- Columns: `workspace_id` text FK → `workspace.id` `ON DELETE CASCADE`,
  `key` varchar(100), `cap` integer NOT NULL `CHECK (cap >= 0)`, plus
  `created_at`/`updated_at` from the shared helpers.
- Primary key is the composite `(workspace_id, key)` — one cap per meter
  per workspace; clearing a cap deletes the row rather than storing a
  sentinel.
- Generated via `db:generate` (drizzle-kit) so the journal and
  `0019_snapshot.json` stay consistent; applied to the local dev Postgres
  with `db:migrate`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Generated for workspace usage controls (WP2) | Devin |
