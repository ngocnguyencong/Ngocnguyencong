# apps/web/src/billing-bff.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Billing BFF contract tests — checkout/portal auth + workspace scoping +
server-derived price resolution, webhook verify-then-persist ordering,
rejection/acknowledgement paths.

## Coverage

- Checkout: unauthenticated/anonymous rejections; missing price →
  `price-unconfigured`; seat bounds; idempotency identity passed through.
- Portal: customer-record unlock.
- Webhook: invalid signature → 400; irrelevant/unpaid events ack without
  access changes; verified events persist once; **async verifier** case
  awaits a `Promise`-returning `verifySignedWebhook` (PayPal shape).
- Webhook correlation: the stored ledger `payload` always carries a
  `corr_` id — a route-supplied `input.correlationId` is kept and also
  reaches `onBillingLifecycleProcessed` as the emit context's second arg;
  absent input mints a distinct id per call; a malformed caller id is
  dropped and replaced, never propagated.
- `onEntitlementActivated`: fires once per processed active/trialing
  write with `{entitlementKey, eventId, status, subscriptionId,
  workspaceId}`; past_due/inactive writes never trigger it.

## Open Threads / Resume Context

- Tests deny guests and ordinary members before checkout/portal provider calls and retain owner checkout/portal success.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | +duplicate-disposition case: credit hook re-fires (self-healing), notification fan-out still skipped | Devin |
| 2026-10-11 | `onEntitlementActivated` cases: active/trialing fire, non-active statuses don't | Devin |
| 2026-09-29 | CorrelationId cases: ledger payload + emit-context threading, per-call mint, malformed-caller drop | Devin |
| 2026-09-25 | Async-verifier test for the widened webhook contract | Devin |
