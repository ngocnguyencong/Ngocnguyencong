# packages/db/src/usage-counters.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Schema + repository-contract coverage for `usage-counters.ts`.

## Coverage

- `usage_counter` schema — per-workspace table; `(workspace, key,
  period)` uniqueness.
- Repository contract — `createDrizzleUsageCounterRepository` export;
  consume input validated before touching the DB; an explicit `limit` is
  required — `undefined` never silently means unlimited.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
