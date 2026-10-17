# apps/web/src/schedule-actions.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Unit coverage for `schedule-actions.ts` — the `"use server"` schedule
upsert/remove actions.

## Coverage

- `upsertScheduleAction` — rejects platform/unknown types, sub-hour crons,
  malformed crons, and quota exhaustion before the store; maps the database's
  atomic concurrent quota error; normalizes/audits valid types; surfaces the
  manager-gate error.
- `removeScheduleAction` — removes a workspace schedule and audits.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Cover registered handler/cadence guards and both quota paths | Codex |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
