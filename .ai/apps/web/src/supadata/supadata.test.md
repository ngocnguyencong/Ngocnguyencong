# apps/web/src/supadata/supadata.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Unit tests for the supadata domain layer: channel classification, UA parsing, geo normalization, id formats, funnel math, api envelope — mocks `server-only` so pure functions run under Vitest.

## Important Notes / NEVER Change

- Keep the `server-only` mock at the top or every import of the domain layer fails in tests.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
| 2026-10-16 | +tests for `previousRange`/`percentChange` (15 tests total) | Devin |
