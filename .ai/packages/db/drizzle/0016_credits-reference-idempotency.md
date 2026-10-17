# packages/db/drizzle/0016_credits-reference-idempotency.sql

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Hardens the credit ledger: a partial unique index on
`(workspace_id, kind, reference_id)` plus a non-negative balance CHECK.

## Important Notes

- `uq_credit_transaction_reference` is `WHERE reference_id IS NOT NULL` —
  one ledger row per (workspace, kind, reference) so raced webhook replays
  and duplicate activations hit 23505 instead of double-writing; NULL
  references (manual admin grants) stay repeatable.
- Repositories classify that conflict as idempotent: grants return
  `granted:false`, quota-overflow debits report the charge already paid.
- `credit_balance_nonnegative` is defense in depth under the guarded
  `UPDATE ... WHERE balance + amount >= 0` — the ledger cannot go negative
  even if a future write path bypasses the repository guard.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | Created for review-hardening: reference idempotency + balance CHECK | Devin |
