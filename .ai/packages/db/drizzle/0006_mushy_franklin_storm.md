# packages/db/drizzle/0006_mushy_franklin_storm.sql

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Adds `rate_limit_bucket` — the shared Postgres fixed-window rate-limit
store (`rate-limit-store.ts`).

## Important Notes

- `idx_rate_limit_bucket_expires` on `expires_at` — the platform
  `rate-limit.prune` schedule sweeps dead buckets through this index.
- Store row = `key`, `count`, `window_start`, `expires_at`; the atomic
  `INSERT ... ON CONFLICT DO UPDATE` lives in the repository, not here.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
