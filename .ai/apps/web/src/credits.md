# apps/web/src/credits.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Server-only wrappers around the workspace credit ledger — thin accessors
over the app `database` using `createDrizzleCreditsRepository`, the same
shape `usage-quota.ts` uses for the `usage_counter` repository.

## What It Does

- `getWorkspaceCredits(workspaceId)` — current prepaid balance (`0` when no
  `credit_balance` row exists).
- `listWorkspaceCreditTransactions(workspaceId, limit?)` — newest-first
  ledger entries (default 50).
- `grantWorkspaceCredits({ workspaceId, amount, reason?, referenceId?,
  actorUserId? })` — appends a `grant` row. When `referenceId` is supplied
  the grant is idempotent: an existing grant-kind row with that reference
  skips the write and reports `granted: false` (webhook replays). The
  `uq_credit_transaction_reference` unique index is the real guard — a
  raced `23505` also reports `granted: false`.
- `debitWorkspaceCredits({ workspaceId, amount, reason?, referenceId? })` —
  appends a `debit` row; callers pass a positive `amount` which the ledger
  stores negated. Propagates `InsufficientCreditsError` on an empty pool.
  Non-positive/non-integer amounts are rejected before SQL runs.

## Important Notes

- `import "server-only"` — the module caches a single repository per
  process behind a lazy initializer.
- Optional fields are omitted from the append input rather than passed as
  `undefined` (exactOptionalPropertyTypes).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | Grant idempotency hardened: kind-scoped fast-path check + `uq_credit_transaction_reference` violation → `granted: false`; `debitWorkspaceCredits` validates positive integer amounts | Devin |
| 2026-10-11 | Server-side credit ledger wrappers for routes, quota overflow, billing grants, and admin grants | Devin |
