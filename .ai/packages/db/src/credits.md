# packages/db/src/credits.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Drizzle repository for the prepaid workspace credit pool — `credit_balance`
(current balance per workspace) plus `credit_transaction` (append-only
ledger), migration 0015. Credits are the consumable balance that keeps
metered actions running after a plan's `usageLimits` quota is exhausted;
`apps/web/src/usage-quota.ts` debits them on quota overflow.

## What It Does

- `createDrizzleCreditsRepository(db)` —
  `appendTransaction({ workspaceId, amount, kind, reason?, referenceId?,
  actorUserId? })`: inside ONE database transaction, applies the signed
  delta to `credit_balance` and appends the ledger row with the resulting
  `balanceAfter`. Non-negative deltas use an upsert; negative deltas use a
  guarded `UPDATE ... WHERE balance + amount >= 0` that takes the row lock
  while re-checking, so concurrent debits serialize and a failing debit
  writes nothing.
- `InsufficientCreditsError` — thrown when a debit would drive the balance
  negative; the transaction rolls back (no balance row, no ledger row).
- `getBalance(workspaceId)` — `0` when no `credit_balance` row exists.
- `listTransactions(workspaceId, limit = 50)` — newest-first ledger reads,
  bounded to 1..500 rows.
- `hasTransactionWithReference(workspaceId, referenceId, kind?)` —
  workspace-scoped idempotency lookup used for reference-keyed grants
  (billing lifecycle plan grants dedupe on
  `plan-credit:<provider>:<subscriptionId>`); `kind` narrows the lookup to
  one movement kind.
- `isCreditReferenceConflict(error)` — true for a `23505` violation on the
  `uq_credit_transaction_reference` unique index; callers treat it as
  "already applied", not an error.
- `CREDIT_TRANSACTION_KINDS` — grant/debit/refund/expire/adjustment, with
  sign enforced per kind (grants/refunds positive, debits/expires
  negative); `MAX_CREDIT_AMOUNT` bounds a single delta.

## Important Notes

- Every query is `workspaceId`-scoped — balance, ledger, and the
  reference lookup never cross workspaces.
- Kind/sign mismatches and zero amounts are rejected before SQL runs.
- `uq_credit_transaction_reference` (migration 0016) makes every
  reference-bearing movement idempotent at the DB level — concurrent
  same-(workspace, kind, reference) writes conflict instead of
  double-applying; `credit_balance_nonnegative` CHECK guards the balance.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | +`isCreditReferenceConflict` (23505 → idempotent result); `hasTransactionWithReference` gains optional `kind` filter | Devin |
| 2026-10-11 | Prepaid workspace credits: balance upsert + guarded debit + append-only ledger with `balanceAfter`, reference-keyed idempotency lookup | Devin |
