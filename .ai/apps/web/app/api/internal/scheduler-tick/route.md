# apps/web/app/api/internal/scheduler-tick/route.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Internal scheduler tick — the local/dev/CI driver for `job_schedule`
when Trigger.dev isn't running the tick. Claims due schedules and
enqueues `job.run` dispatches (same path as the `scheduler.tick` cron).

## Important Notes

- Disabled unless `SCHEDULER_TICK_SECRET` is configured — with no secret
  the endpoint 404s like it doesn't exist; requests must authenticate
  with the secret.
- `force-dynamic`, nodejs runtime; response headers
  `cache-control: no-store` + `x-robots-tag: noindex`.
- Driven locally/CI by `scripts/scheduler-tick.mjs` (`pnpm jobs:tick`);
  on a non-2xx the driver exits non-zero.
- Errors surface as 429-retryable vs hard-fail per tick semantics — the
  route returns `Retry-After` headers on rate-shaped rejections.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
