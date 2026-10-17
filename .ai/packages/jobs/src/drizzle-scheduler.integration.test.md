# packages/jobs/src/drizzle-scheduler.integration.test.ts

> Last updated: 2026-10-02 | Protection: STANDARD

## Purpose

`TEST_DATABASE_URL`-gated Postgres coverage for the durable claim path —
real transactions against `job_schedule`.

## Coverage

- Due-claim inside one transaction (≤ `MAX_CLAIM_LIMIT`), fired marking,
  next-occurrence write via cron; platform (NULL workspace) rows claim
  alongside workspace rows; missed occurrences catch up on the next tick.
- Missed-run durability — a forced-overdue row claims with the right
  `missedDelta`/cumulative `missedRuns`, the row persists the increment,
  a second late claim accumulates more, dryRun projects without writing,
  and a neighboring workspace's counter stays at zero.

## Agent Decisions / Thoughts

- **2026-10-07:** Workspace-owned fixtures must use an hourly cron because
  `upsertSchedule` enforces that cadence even for disabled rows. Align the
  missed-run tick and forced overdue timestamps to hourly boundaries so the
  existing delta/durability assertions remain meaningful. Keep minute-level
  cron coverage on platform rows (`workspaceId: null`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-07 | Workspace integration fixtures follow the hourly cadence invariant | Codex |
| 2026-10-02 | +`missed_runs` durable claim accumulation case | Devin |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
