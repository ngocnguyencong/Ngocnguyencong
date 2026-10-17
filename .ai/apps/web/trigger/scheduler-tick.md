# apps/web/trigger/scheduler-tick.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Declarative Trigger.dev cron `scheduler.tick` (`schedules.task`, SDK
4.5.x): fires every minute; each run claims due `job_schedule` rows and
enqueues `job.run` tasks.

## Important Notes

- The durable claim lives in Postgres — missed minutes catch up on the
  next run; the task provides the cadence, not the mechanism.
- `cron: "*/1 * * * *"`, run delegates to `tickScheduler({ now:
  payload.timestamp })` in `scheduler-runtime`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
