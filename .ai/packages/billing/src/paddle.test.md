# packages/billing/src/paddle.test.ts

> Last updated: 2026-09-25 | Protection: STANDARD

## Purpose

Offline unit tests for `PaddleBillingAdapter` (5) — fake
`PaddleBillingClient` double; real `Paddle-Signature` HMAC payloads
(`ts;h1` over `ts:payload`).

## Coverage

- Checkout: items/quantity, `custom_data` {workspaceId, entitlement,
  priceId}, email passthrough; `successUrl` intentionally not forwarded.
- Portal: `createCustomerPortalSession` → `{url}`; null url throws.
- Webhook: valid signature verifies + maps `subscription.activated` with
  `custom_data` workspace binding; tampered signature rejects; missing
  `data`/non-record payload rejects; `adjustment.updated` refund maps
  inactive without falling back to the adjustment id as subscriptionId.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-25 | Initial tests (phase B5) | Devin |
