# apps/web/app/api/billing/webhook/creem/route.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Public Creem billing webhook receiver for the provider-specific signed event path.

## Open Threads / Resume Context

- The route uses the shared 1 MiB streaming payload cap before signature verification. The body read happens inside the `try`, so a non-oversize stream failure is reported via `captureException` and returns 500 rather than escaping the handler.
- A `newCorrelationId()` is minted per request and shared by the `bff.webhook({correlationId})` call and the `captureException` context — the ledger write, emitted workspace events, and any failure report join on one id.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | Per-request `newCorrelationId()` minted → `webhook({correlationId})` + `captureException` context | Devin |
