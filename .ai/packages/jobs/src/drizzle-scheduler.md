# packages/jobs/src/drizzle-scheduler.ts

> Last updated: 2026-10-02 | Protection: STANDARD

## Purpose

Drizzle/Postgres implementation of the `JobScheduler` contract: durable
`job_schedule` rows (migrations 0010–0011, +`missed_runs` in 0013)
claimed transactionally by each scheduler tick.

## What It Does

- `createDrizzleJobScheduler(db)` — claim due rows (`next_run_at <= now`,
  `enabled`) inside one transaction, mark fired, compute the next cron
  occurrence via `nextCronRun`/`parseCronExpression` (`./scheduler`).
- `MAX_CLAIM_LIMIT = 500` (default claim 100) — bounds rows per tick so
  one transaction stays small; claims cap each workspace at 10 rows per
  tick for tenant fairness.
- Workspace upserts serialize on a workspace advisory lock and atomically
  enforce `MAX_WORKSPACE_SCHEDULES = 20`, while allowing updates at quota.
- The lock, quota count, and write share one transaction, including
  deterministic-id workspace upserts.
- Workspace upserts reject recurrence more frequent than hourly;
  platform schedules retain minute-level cadences.
- `SCHEDULE_TYPE_PATTERN = /^[a-z0-9._-]+$/i` for schedule type
  validation; `ScheduleNotFoundError` on missing ids.
- `CronSchedule`, `ClaimedCronSchedule`, `DrizzleScheduleInput` types.

## Important Notes

- `job_schedule.workspace_id` is nullable — null rows are platform-owned
  schedules (`PLATFORM_JOB_TYPES`); the partial unique index
  `idx_job_schedule_workspace_type` keeps workspace schedules one-per-type
  while platform rows stay unindexed there.
- Claim is the durable mechanism — Trigger.dev cron only supplies the
  cadence; missed minutes catch up next tick.
- A claim fires the stored `next_run_at` occurrence (late if the tick ran
  behind) and adds `missed_runs += countCronRuns(cron, stored, now)` in
  the same UPDATE — the skipped occurrences, durable in 0013. Returned
  rows carry the post-claim `missedRuns` plus the claim's `missedDelta`
  (dryRun projects both without writing). Upserts never SET
  `missed_runs` — the counter is claim-owned.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Add atomic workspace schedule quota, hourly cadence and fair claims | Codex |
| 2026-10-02 | `claimDueSchedules` → `ClaimedCronSchedule[]`: per-row `missed_runs += delta` (countCronRuns), dryRun-projected totals, claim SELECT += `missed_runs` | Devin |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
