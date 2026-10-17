# packages/db/src/usage-counters.integration.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`TEST_DATABASE_URL`-gated Postgres coverage for the guarded consume
update — concurrent increments, limit enforcement, and period rollover.

## Coverage

- `consume` increments atomically; over-limit consume returns
  `{allowed:false}` without mutating `used`; unlimited (`limit: null`)
  counters bypass the guard; per-period rows stay independent.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
