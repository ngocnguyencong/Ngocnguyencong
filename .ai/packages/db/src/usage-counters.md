# packages/db/src/usage-counters.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Drizzle repository for `usage_counter` (migration 0009) — atomic
metered-usage counters keyed `(workspaceId, key, periodStart)` backing
plan quotas (`apps/web/src/usage-quota.ts`).

## What It Does

- `createDrizzleUsageCounterRepository(db)` —
  `consume({ workspaceId, key, periodStart, limit, amount })`: a single
  guarded `INSERT ... ON CONFLICT DO UPDATE` that increments `used` only
  while `used + n <= limit` (or unbounded when `limit` is null), then
  returns `ConsumeUsageCounterResult` (allowed/used/limit).
- `MAX_USAGE_QUOTA` — bounds the configured limit AND a single consume
  amount; on the limited path `used <= limit <= MAX` and `n <= MAX` keep
  `used + n` below the int4 maximum, so the guarded UPDATE cannot
  overflow.

## Important Notes

- Unlimited counters (`limit: null`) skip the guard — a metered key
  consumed past ~2^31 can still hit the int4 ceiling; `MAX` is a contract
  for bounded quotas, not a physical guarantee for unlimited ones.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
