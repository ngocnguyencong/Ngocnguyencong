# src/ai-spend.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Shared committed/held AI spend read for one UTC month:
`readAiSpendForPeriod(database, workspaceId, periodStart)` sums
`ai_usage.cost_microunits` created inside `[monthStart, nextMonthStart)`
(committed) and `ai_budget_reservation.reserved_microunits` pinned to the
period start with status `"reserved"` (held).

## Important Notes

- This is the exact read the AI budget-enforcement transaction uses —
  `repositories.ts` calls it inside its reservation flow — so the Settings
  → Usage overview and enforcement can never disagree on the numbers.
- `AiSpendDatabase = Pick<PostgresJsDatabase, "select">` deliberately
  accepts both the root database and a transaction handle so read-only
  callers and the enforcement transaction share the query shapes.
- `periodStart` is normalized to its UTC month start internally; callers
  may pass any date inside the month.
- Returns bigints — web callers serialize to decimal strings
  (`usage-overview.ts`) before crossing the JSON/RSC boundary.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2); extracted from the `repositories.ts` budget-reservation inline queries | Devin |
