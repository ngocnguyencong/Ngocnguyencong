# src/usage-caps.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Owner/admin-set usage caps backing Settings → Usage:
`createDrizzleUsageCapRepository` implements `list`/`get`/`set`/`clear`
against `workspace_usage_cap` (PK `(workspace_id, key)`, `cap` integer
`>= 0`). Caps are hard ceilings layered over plan `usageLimits` — the web
quota path resolves `min(plan limit, cap)` and a cap-bound rejection never
falls back to prepaid credits.

## Important Notes

- Scoped by `workspaceId` + meter `key` (max 100 chars, same contract as
  `usage_counter` keys); unlike `usage_counter` rows, caps persist across
  months — they are policy, not consumption.
- `set` validates `cap` is an integer in `0..MAX_USAGE_QUOTA` and upserts on
  the composite PK; `clear` deletes the row (no-op when absent) — clearing
  restores plan-limit behavior rather than writing a sentinel.
- `UsageCapRepository` is an interface so the web quota layer injects it —
  `apps/web/src/usage-quota.ts` takes a `caps` dependency for tests.
- `UsageCapDatabase` requires the full `PostgresJsDatabase` (insert/delete),
  unlike `ai-spend.ts` which only needs `select`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
