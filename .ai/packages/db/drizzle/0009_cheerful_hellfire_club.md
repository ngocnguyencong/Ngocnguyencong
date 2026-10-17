# packages/db/drizzle/0009_cheerful_hellfire_club.sql

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Adds `usage_counter` — per-workspace metered usage counters backing plan
quotas (`usage-counters.ts`, `apps/web/src/usage-quota.ts`).

## Important Notes

- FK `workspace_id → workspace.id` `ON DELETE cascade`;
  `idx_usage_counter_workspace` for per-workspace listing.
- Counter identity is `(workspace_id, key, period_start)`; `used`/`limit`
  columns consumed atomically by the repository's guarded update.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
