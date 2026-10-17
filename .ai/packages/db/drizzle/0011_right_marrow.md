# packages/db/drizzle/0011_right_marrow.sql

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Indexes for the production scheduler claim path (`drizzle-scheduler.ts`).

## Important Notes

- `idx_job_schedule_workspace_type` — UNIQUE partial on
  `(workspace_id, type) WHERE workspace_id IS NOT NULL`: one schedule per
  type per workspace, while NULL-workspace platform rows stay free of it.
- `idx_job_schedule_next_run_at` — partial on `next_run_at WHERE enabled`:
  the tick's due-scan (`WHERE enabled AND next_run_at <= now`) is an
  index-only walk.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
