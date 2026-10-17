# apps/web/src/account-actions.test.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose

Action-level regressions for account session revocation and account deletion.

## Important Notes

- Verify that unowned session IDs never reach Better Auth's token-based revoke
  API, and that a current request can revoke one of its own other sessions.
- Concurrent self-deletions by the last two organization owners must serialize
  through the shared workspace lock; only one deletion may commit.
- A deterministic late membership in a previously unseen organization must
  force a transaction retry; the retried owner check must block deletion when
  the actor is that organization's sole owner.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-04 | Cover token-free session projections, own-session ID resolution, concurrent last-owner deletion, and unseen-workspace retry | Codex |
