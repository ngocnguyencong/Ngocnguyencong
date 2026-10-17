# packages/db/drizzle/0013_gray_pixie.sql

> Last updated: 2026-10-02 | Protection: STANDARD

## Purpose

Adds `job_schedule.missed_runs` — the cumulative counter of cron
occurrences that elapsed while no scheduler tick claimed them.

## Important Notes

- Single `ALTER TABLE … ADD COLUMN "missed_runs" integer DEFAULT 0 NOT
  NULL` — additive-safe: existing rows backfill to 0, no rewrite beyond
  the metadata default on Postgres ≥ 11.
- Claim-owned column: `claimDueSchedules` adds
  `missed_runs + countCronRuns(cron, stored next_run_at, now)` inside the
  same UPDATE that stamps `last_run_at`/advances `next_run_at`; upserts
  never SET it (inserts use the default, conflicts preserve).
- A claimed fire IS the stored `next_run_at` occurrence dispatched late —
  the counter records how many occurrences were skipped, not replayed.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-02 | Created for missed-occurrence accounting on scheduler claims | Devin |
