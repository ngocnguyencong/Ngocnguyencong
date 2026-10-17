# apps/web/app/api/billing/webhook/dodo/route.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Dodo Payments webhook receiver — mirrors the Whop route: raw body +
Standard Webhooks headers (`webhook-id`/`webhook-timestamp`/
`webhook-signature` packed via `encodeStandardWebhookSignature`) verified
with `DODO_PAYMENTS_WEBHOOK_KEY`, then the shared entitlement ledger. No
session auth; invalid payloads rejected.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | Per-request `newCorrelationId()` minted → passed to `bff.webhook({correlationId})` and the `captureException` context | Devin |
| 2026-09-27 | Body read moved inside the `try` — non-oversize stream failures now report via `captureException` and return 500 instead of escaping the handler | Devin |
| 2026-09-25 | Initial route (phase B5) | Devin |

## Security Fix (2026-09-27)

Reads the raw signed payload through the shared 1 MiB streaming cap before invoking the billing BFF; oversized bodies return 413. The bounded read runs inside the `try`, so other stream failures hit the `catch` → `captureException` → 500 path (the `{response}` union still short-circuits on 413).
