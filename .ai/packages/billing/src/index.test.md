# packages/billing/src/index.test.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Offline tests for the shared Stripe billing adapter and normalized webhook
contract; all provider and ledger interactions use fake clients.

## Coverage

- Checkout metadata and idempotency translation.
- Signed subscription events use the current Stripe item price when present,
  even when subscription metadata still contains the original checkout price.
- Signature rejection and subscription lifecycle mapping.

## Open Threads / Resume Context

- **Status:** in_progress
- **Intent:** Keep provider webhook price normalization aligned with durable plan resolution.
- **Blockers / notes:** Test-only webhook fixtures; no Stripe network calls.
