# packages/db/src/platform-ai-spend.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Platform-wide daily spend ledger for anonymous/public AI calls on
`platform_ai_spend` (migration 0007 — one row per UTC `YYYY-MM-DD` day, no
workspace FK). Used by `apps/web/src/public-ai-runtime.ts`.

## Public API

- `reservePlatformAiSpend(db, { day, amount, limit }) → boolean` — single
  atomic `INSERT ... ON CONFLICT ... WHERE spent + amount <= limit RETURNING`;
  no returned row → `false`. `amount > limit` is rejected in code before the
  statement.
- `releasePlatformAiSpend(db, { day, amount })` — gives a reservation back;
  `GREATEST(0, …)` so spend never goes negative.
- `settlePlatformAiSpend(db, { day, reserved, actual })` — replaces the
  reservation with actual usage (`spent - reserved + actual`, clamped ≥0).
  Actual spend is truth and may push the day past `limit`.

## Dependencies

- `drizzle-orm` `sql` + `PostgresJsDatabase<typeof schema>` (same raw-execute
  path as `rate-limit-store.ts` — bigint params are fine, `Date` params are
  NOT, see that module's notes).

## Important Notes / NEVER Change

- Reserve is the only function that enforces the limit; release/settle adjust
  unconditionally (failed attempts and real overage must still reconcile).
- `day` strings are produced by callers (`toISOString().slice(0,10)`) — the
  module does not validate the format.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created (Task 6, feat/prod-ready-kit) | Devin |
