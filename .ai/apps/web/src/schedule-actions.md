# apps/web/src/schedule-actions.ts

> Last updated: 2026-10-02 | Protection: STANDARD

## Purpose

`"use server"` actions for workspace `job_schedule` management under
Settings → Developers (`/settings/developers` revalidate path).

## What It Does

- Shares one `createDrizzleJobScheduler(database)` store with the tick
  runtime — upserts compute `nextRunAt` via `nextCronRun`/
  `parseCronExpression`; `claimDueSchedules` is what the scheduler
  endpoint ticks.
- `upsertScheduleAction` — manager-gated upsert: allows only registered
  tenant handlers; rejects platform/unknown types, sub-hour recurrence,
  malformed or unschedulable crons, and new rows over the workspace quota;
  checks the current list for an early friendly quota error and relies on
  the scheduler's advisory-locked transaction for race-safe enforcement;
  normalizes type and audits successful writes.
- `removeScheduleAction` — removes a workspace schedule + audits.
- `WorkspaceScheduleRow` — the panel-facing row shape; `missedRuns`
  carries the cumulative `job_schedule.missed_runs` total into the
  Cron schedules list.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Restrict workspace schedule type/cadence/count and map concurrent quota errors | Codex |
| 2026-10-02 | `WorkspaceScheduleRow` += `missedRuns` (claim-recorded skipped occurrences) | Devin |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
