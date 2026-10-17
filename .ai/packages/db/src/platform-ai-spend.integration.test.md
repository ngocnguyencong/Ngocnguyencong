# packages/db/src/platform-ai-spend.integration.test.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Real-Postgres tests for `platform-ai-spend.ts`, gated on `TEST_DATABASE_URL`
(identical harness to `postgres.integration.test.ts`).

## What It Does

- Reserve 300n ×4 with limit 1000n → `true,true,true,false`; stored spend 900n.
- `amount > limit` → `false` with no row written.
- 10 concurrent reserves of 150n, limit 1000n → exactly 6 succeed (atomicity
  under parallel connections; `maxConnections: 10`).
- Release decrements and clamps at 0; settle adjusts both directions
  (300→120 → 120; then reserved 300/actual 5000 → 4820, over limit allowed).
- Fixed `2099-*` days; each test deletes its day before and after.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created (Task 6, feat/prod-ready-kit) | Devin |
