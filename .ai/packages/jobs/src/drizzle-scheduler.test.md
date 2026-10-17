# packages/jobs/src/drizzle-scheduler.test.ts

> Last updated: 2026-10-02 | Protection: STANDARD

## Purpose

Schema + validation coverage for `drizzle-scheduler.ts`.

## Coverage

- `job_schedule` schema — NULL `workspace_id` allowed for platform-level
  schedules; partial unique `(workspace, type)`.
- `createDrizzleJobScheduler` — invalid upsert/claim/remove inputs
  rejected before touching the database; `SCHEDULE_TYPE_PATTERN`
  enforcement.
- Claim missed-run accounting — the SELECT lists `missed_runs`, the
  UPDATE adds `missed_runs + delta`, returned rows carry cumulative
  `missedRuns` + `missedDelta` (multi-day-late, on-time zero, dryRun
  projected); upserts never SET `missed_runs`.
- Claim SQL applies a per-workspace cap while retaining `FOR UPDATE SKIP
  LOCKED`; workspace upserts lock and enforce the atomic row quota.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-02 | +`missed_runs` claim SQL/delta/cumulative + no-upsert-SET coverage | Devin |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
