# apps/web/app/api/billing/webhook/polar/route.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Polar webhook receiver — mirrors the Creem route: reads the raw body,
verifies via `validateEvent` (Standard Webhooks) with
`POLAR_WEBHOOK_SECRET`, and feeds the shared entitlement ledger. No
session auth; unsigned/invalid payloads are rejected.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | Per-request `newCorrelationId()` minted → passed to `bff.webhook({correlationId})` and the `captureException` context | Devin |
| 2026-09-27 | Body read moved inside the `try` — non-oversize stream failures now report via `captureException` and return 500 instead of escaping the handler | Devin |
| 2026-09-22 | Initial route (phase B1) | Devin |

## Security Fix (2026-09-27)

Reads the raw signed payload through the shared 1 MiB streaming cap before invoking the billing BFF; oversized bodies return 413. The bounded read runs inside the `try`, so other stream failures hit the `catch` → `captureException` → 500 path (the `{response}` union still short-circuits on 413).
