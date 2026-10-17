# packages/billing/src/whop.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Offline tests for `WhopBillingAdapter`: checkout configuration metadata,
portal `manage_url` resolution + static fallback, Standard Webhooks
unwrap rejection paths, `payment.succeeded` / `membership.activated` /
`membership.deactivated` ledger mappings, membership-id extraction.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial tests (phase B1) | Devin |

## Open Threads / Resume Context

- **Status:** in_progress
- **Intent:** Pin that a membership's current plan id overrides stale checkout metadata during webhook normalization.
- **Blockers / notes:** Uses fake Standard Webhooks client; no network calls.
