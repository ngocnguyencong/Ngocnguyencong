# packages/db/src/repositories.ts

## Purpose

Workspace-scoped repositories and Drizzle transaction executor, including
atomic AI provider-attempt authorization and monthly budget reservations.

## Important Notes

- Entitlement and task ownership are checked inside the authorization
  transaction. Finite budgets reserve estimated usage under a row lock.
- The committed/held spend sums inside the budget-reservation transaction
  call the shared `readAiSpendForPeriod` (`./ai-spend.ts`, select-only DB
  type so the transaction handle qualifies) — the Settings → Usage
  overview reads the same function, so enforcement and display can never
  disagree.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Budget-reservation committed/held spend queries extracted to shared `readAiSpendForPeriod` (`./ai-spend.ts`) for the Settings → Usage overview (WP2) | Devin |

## Open Threads / Resume Context

- No reaper exists for `ai_budget_reservation` rows stuck in `reserved`
  (worker crash between authorization and settle) — they hold budget until
  the billing month rolls over.

## Security Fix (2026-09-27)

AI provider authorization locks the workspace row so default-budget reservations serialize even without a policy row, then checks committed spend plus active holds against the effective limit.
