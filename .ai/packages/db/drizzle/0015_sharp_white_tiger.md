# packages/db/drizzle/0015_sharp_white_tiger.sql

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Adds four tables for the competitor-parity feature set: `credit_balance`
and `credit_transaction` (prepaid workspace credits), `device_push_token`
(Expo push registration), and `analytics_event` (first-party local
analytics).

## Important Notes

- `credit_balance` is keyed on `workspace_id` (PK, cascade FK); the ledger
  `credit_transaction` stores signed `amount`, `balance_after`,
  `reference_id` idempotency hints, and `actor_user_id` (set-null FK).
- `device_push_token.token` is unique — `register` upserts on it so
  reinstalls re-point the row instead of duplicating devices.
- `analytics_event.workspace_id` is nullable (site-level events have no
  workspace); raw IP/user-agent are never stored, only `visitor_hash` +
  `referrer_host`.
- Indexes: per-workspace ledger reads
  (`idx_credit_transaction_workspace_created`), reference lookup
  (`idx_credit_transaction_reference`), token/user/workspace push lookups,
  and created/kind analytics scans.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Created for workspace credits, push tokens, and local analytics | Devin |
