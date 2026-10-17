# apps/web/src/scheduler-tick-route.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Route contract coverage for `POST /api/internal/scheduler-tick`.

## Coverage

- 404 when `SCHEDULER_TICK_SECRET` unset (endpoint stays disabled); 401
  on missing/wrong key.
- Runs the tick → per-schedule results with `no-store`/`noindex`
  headers; forwards validated `{dryRun}`; 400s malformed bodies.
- Rate-limits the shared unknown-IP scheduler-tick bucket before auth;
  forwarding headers cannot rotate the key.
- Tick failure → generic 500 + error captured.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
