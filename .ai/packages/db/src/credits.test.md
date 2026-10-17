# packages/db/src/credits.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Contract tests for `createDrizzleCreditsRepository` against a fake/capturing
database — the same strategy `usage-counters.test.ts` uses, so no live
Postgres is required.

## What It Does

- Asserts the balance-write SQL shape per branch: upsert for non-negative
  deltas, guarded `UPDATE` with the `balance + amount >= 0` predicate for
  debits.
- Covers grant/debit balance changes, `balanceAfter` recorded on the ledger
  row, kind/sign validation, and bounded `listTransactions` limits.
- Verifies `InsufficientCreditsError` on an insufficient debit and that the
  transaction writes nothing in that case.
- Exercises `hasTransactionWithReference` for workspace-scoped idempotent
  grant checks.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | TDD contract suite for the credits repository | Devin |
