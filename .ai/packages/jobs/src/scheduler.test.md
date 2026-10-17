# packages/jobs/src/scheduler.test.ts

> Last updated: 2026-10-02 | Protection: STANDARD

## Purpose

Coverage for `scheduler.ts` — cron parsing/next-run + `LocalJobScheduler`.

## Coverage

- `parseCronExpression` — accepts five-field expressions, rejects
  malformed input.
- `isAtLeastHourlyCron` — accepts one-minute-per-hour recurrence and rejects
  minute-dense schedules.
- `nextCronRun` — next matching minute for step/fixed fields; POSIX
  stepped-single expansion (`n-max/step`); day-of-month ∪ day-of-week
  union when both restricted.
- `countCronRuns` — strict-after/inclusive-to bounds, dense schedules,
  POSIX day-field unions, 0 for invalid/unschedulable crons, saturation
  at `MAX_MISSED_RUN_COUNT`.
- `LocalJobScheduler` — register workspace schedule, list, remove; a
  late `tick` counts skipped occurrences into `missedRuns` (on-time
  ticks count 0, disabled schedules untouched, upserts preserve the
  cumulative total).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Add tenant cadence regression cases | Codex |
| 2026-10-02 | +`countCronRuns` suite; +`missedRuns` tick/upsert coverage | Devin |
| 2026-09-27 | Extended via feat/prod-ready-kit — initial mirror | Devin |
