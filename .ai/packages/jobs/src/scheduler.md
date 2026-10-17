# packages/jobs/src/scheduler.ts

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Cron parsing/next-run computation + the `JobScheduler` contract
(`JobRunner` promises only enqueue/status/cancel — Trigger.dev workflow
semantics stay explicit).

## What It Does

- `parseCronExpression` — five-field expressions, rejects malformed input.
- `isAtLeastHourlyCron` — workspace-safe recurrence predicate; exactly one
  selected minute per hour is required, while platform jobs retain their
  higher-frequency schedules.
- `nextCronRun` — POSIX semantics: stepped single values expand to
  `n-max/step`; day-of-month ∪ day-of-week when both restricted. The
  minute-walk lives in private `nextCronMatch(cron, from, within?)` —
  `within` bounds the walk (`cursor > within` → null).
- `countCronRuns` — occurrences strictly after `fromExclusive` and at or
  before `to` (the runs elapsed while no tick claimed them); parses once,
  steps `nextCronMatch` bounded by `to` (a sparse cron never walks past
  `to` for the confirmation), saturates at `MAX_MISSED_RUN_COUNT`
  (10 000), counts 0 for invalid crons.
- `CronSchedule.missedRuns` is cumulative — an upsert re-anchors
  `nextRunAt` from now, forgiving the in-flight gap (never counted).
- `LocalJobScheduler` — in-memory implementation for dev/tests; `tick`
  adds each fire's missed delta into the cumulative `missedRuns`.
- `CronSchedule` (+ `missedRuns`), `ClaimedCronSchedule` (claimed row +
  `missedDelta`), `ScheduleNotFoundError` shared with
  `drizzle-scheduler.ts`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Add minimum hourly tenant schedule cadence | Codex |
| 2026-10-02 | +`missedRuns` on `CronSchedule`, +`ClaimedCronSchedule`, +`countCronRuns`/`MAX_MISSED_RUN_COUNT`; `tick` records skipped occurrences | Devin |
| 2026-10-03 | Minute-walk extracted to `nextCronMatch` with `within` bound; `countCronRuns` parses once + bounds each step by `to` | Devin |
| 2026-09-27 | Extended by feat/prod-ready-kit (durable-claim contract) — mirror created | Devin |
