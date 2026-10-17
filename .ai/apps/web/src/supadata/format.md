# apps/web/src/supadata/format.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Client-safe display formatters: fmtNum (k/M), fmtMoney (cents→Intl), fmtPct (ratio→%), fmtDuration, fmtDate/Time.

## Important Notes / NEVER Change

- None.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
| 2026-10-16 | +`previousRange(range)` and `percentChange(cur, prev)` pure helpers for KPI deltas | Devin |
