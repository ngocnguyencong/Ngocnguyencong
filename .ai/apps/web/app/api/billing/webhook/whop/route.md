# apps/web/app/api/billing/webhook/whop/route.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Whop webhook receiver — mirrors the Creem route: raw body + Standard
Webhooks headers verified with `WHOP_WEBHOOK_SECRET`, then the shared
entitlement ledger. No session auth; invalid payloads rejected.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | Per-request `newCorrelationId()` minted → passed to `bff.webhook({correlationId})` and the `captureException` context | Devin |
| 2026-09-27 | Body read moved inside the `try` — non-oversize stream failures now report via `captureException` and return 500 instead of escaping the handler | Devin |
| 2026-09-22 | Initial route (phase B1) | Devin |

## Security Fix (2026-09-27)

Reads the raw signed payload through the shared 1 MiB streaming cap before invoking the billing BFF; oversized bodies return 413. The bounded read runs inside the `try`, so other stream failures hit the `catch` → `captureException` → 500 path (the `{response}` union still short-circuits on 413).
