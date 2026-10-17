# packages/billing/src/polar.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Offline unit tests for `PolarBillingAdapter` — fake `PolarBillingClient`
records calls; no network. Covers checkout metadata, portal URL,
`validateEvent` rejection paths, and every lifecycle event mapping onto
shared ledger statuses.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial tests (phase B1) | Devin |

## Open Threads / Resume Context

- **Status:** in_progress
- **Intent:** Pin that a subscription's current product id overrides stale checkout metadata during webhook normalization.
- **Blockers / notes:** Uses fake Standard Webhooks client; no network calls.
