# apps/web/src/usage-quota.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Unit coverage for `usage-quota.ts`.

## Coverage

- `monthStart` — first instant of the UTC calendar month.
- `resolveWorkspacePlan` — free-plan fallback; first catalog plan whose
  entitlement is granted; null when nothing matches and no free plan.
- `resolveUsageLimit` — reads the resolved plan's `usageLimits` entry.
- Consume path — allow/deny at the limit, unlimited plans, counter
  repository contract.
- Credit overflow — a configured-quota rejection debits the injected fake
  `CreditsRepository` (kind `debit`, reason "usage quota overflow",
  caller `referenceId`) and reports `ok: true`; `InsufficientCreditsError`
  restores the rejection; unlimited meters never call the ledger.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | +cap semantics: cap-bound rejection leaves credits untouched, plan-bound still overflows to credits, both-null unlimited, `getQuota` `{used, limit, planLimit, cap}` shape | Devin |
| 2026-10-12 | +reference-conflict cases: same-reference debit conflict → `ok: true`; no-reference conflict propagates | Devin |
| 2026-10-11 | Credit-overflow debit cases via injected credits fake | Devin |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
