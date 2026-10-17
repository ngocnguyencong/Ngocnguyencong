# apps/web/app/api/billing/webhook/routes.test.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Shared ingress tests for the seven bounded-read webhook receivers (stripe,
creem, dodo, lemonsqueezy, paddle, polar, whop).

## What It Covers

- `billing-runtime` BFFs and `serverObservability` are module-mocked; each
  route is driven through `POST` with a real `Request`:
  - a body stream that errors mid-read (real `ReadableStream` +
    `controller.error`) → 500, `captureException` reports the
    `billing.webhook.persist` operation **with a minted `corr_`
    correlationId in its context**, verifier never called — the read
    lives inside the `try` so non-`RequestBodyTooLargeError` failures hit
    the catch instead of escaping the handler;
  - an over-cap payload → 413 straight from the `{response}` union, no
    verifier call, no exception report;
  - a normal payload → 200, verifier receives the unchanged payload text
    plus a per-request `correlationId` matching `/^corr_/`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | Asserts `corr_` correlationId on the `webhook()` call and the `captureException` context | Devin |
| 2026-09-27 | Initial suite pinning in-`try` bounded reads across all seven providers | Devin |
