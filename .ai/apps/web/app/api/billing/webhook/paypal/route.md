# apps/web/app/api/billing/webhook/paypal/route.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

PayPal webhook receiver — mirrors the other providers: raw body + the
five `PayPal-*` transmission headers packed via
`encodePaypalWebhookSignature`, verified server-side with
`PAYPAL_WEBHOOK_ID` (PayPal's `verify-webhook-signature` call — no local
scheme), then the shared entitlement ledger. No session auth; invalid
payloads rejected.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | Per-request `newCorrelationId()` minted → passed to `bff.webhook({correlationId})` inside the verification gate and the `captureException` context | Devin |
| 2026-09-25 | Initial route (phase B5) | Devin |

## Security Fix (2026-09-27)

The public receiver caps each signature header at 2048 characters, checks a fail-closed global quota before body reads, limits the raw signed payload to 1 MiB, and permits at most 20 concurrent remote verification calls per process. The existing PayPal verification still decides authenticity.
