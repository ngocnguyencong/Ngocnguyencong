# scripts/scheduler-tick.mjs

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Trigger one scheduler tick against a running app — the local/dev/CI
driver for `job_schedule` when Trigger.dev isn't in play (`pnpm
jobs:tick`).

## What It Does

- POSTs to `/api/internal/scheduler-tick` on the target app.
- Reads `SCHEDULER_TICK_SECRET` (+ optional `APP_URL` /
  `SCHEDULER_TICK_URL` for the base URL) from the environment, falling
  back to the repo-root `.env`.
- Exits non-zero on a non-2xx response — safe to gate CI on.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
