# packages/db/drizzle/0010_numerous_power_man.sql

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`job_schedule.workspace_id` → `DROP NOT NULL` — platform-level schedules
(`rate-limit.prune`, `connected-account.token-sweep`) carry NULL instead
of a fake workspace.

## Important Notes

- Companion to 0011's partial unique index — workspace schedules stay
  one-per-type; platform rows are NULL-scoped.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
