# apps/web/src/usage-quota.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Usage-quota enforcement seam for server actions: resolves the workspace's
plan limit for a metered key and consumes the counter atomically via
`createDrizzleUsageCounterRepository` (`usage_counter` table, migration
0009). When a CONFIGURED quota rejects, the prepaid credit pool
(`credit_transaction` via `createDrizzleCreditsRepository`) covers the
action so metered work keeps running after the plan quota is exhausted.

## What It Does

- `monthStart(now)` — first instant of the UTC calendar month; the default
  counter period.
- `UsageQuotaDependencies` — plan catalog override (defaults to
  `PRODUCT_PLANS`; tests inject fixtures), counter repository, `credits`
  ledger override, clock.
- Consume flow: entitlement → plan → per-key limit →
  `repository.consume({ workspaceId, key, periodStart, limit, amount })`
  → `ConsumeUsageCounterResult` (allowed/used/limit).
- Overflow flow: `quota_exhausted` with a configured finite limit →
  `credits.appendTransaction({amount: -n, kind: "debit",
  reason: "usage quota overflow", referenceId?})` → `ok: true` on success.
  `input.referenceId` (e.g. the AI task id) links the debit to its cause.

## Important Notes

- `MAX_USAGE_QUOTA` bounds configured limits and single consume amounts so
  the guarded `used + n` cannot overflow int4; unlimited counters
  (`limit: null`) skip the guard.
- Enforcement is per-workspace — the counter key is namespaced
  `(workspaceId, key, periodStart)`.
- Unlimited/unconfigured meters never touch the credit ledger —
  `resolveUsageLimit` returning `null` ends the consume at the counter.
- `InsufficientCreditsError` keeps the original quota rejection; any other
  ledger error propagates (infrastructure failures are not quota denials).
  Exception: a `uq_credit_transaction_reference` conflict on a debit that
  carries a `referenceId` reports `ok: true` — a raced twin already charged
  that reference once, so the loser resolves through the replay path.
- The usage counter stays at its limit on overflow — the ledger row is the
  record of over-quota usage; kit plans ship no `usageLimits` so the seam
  is dormant until a derived product configures keys.
- Workspace caps (`caps` dep → `workspace_usage_cap` via
  `UsageCapRepository`) layer over plan limits: the effective counter
  limit is `min(planLimit, cap)` over the non-null values. A rejection
  where the cap binds (`cap < planLimit` or no plan limit) returns
  `quota_exhausted` WITHOUT touching credits — owner caps are hard
  ceilings; the credit-overflow path only runs when the plan limit binds.
- `getQuota` returns `{used, limit, planLimit, cap}` — `limit` stays the
  effective value so existing callers keep working; `planLimit`/`cap`
  distinguish which ceiling applies (Settings → Usage renders both).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Workspace usage caps: injectable `caps` dep, effective `min(plan, cap)` limit, cap-bound rejections skip the credit ledger; `getQuota` += `planLimit`/`cap` (WP2) | Devin |
| 2026-10-12 | Raced twin debit on the same `referenceId` → unique-index conflict reported as `ok: true` (deduped, not double-spent) | Devin |
| 2026-10-11 | Prepaid-credit quota overflow: `credits` dep + `referenceId` input; debit `n` credits (reason "usage quota overflow") when a configured quota exhausts | Devin |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
