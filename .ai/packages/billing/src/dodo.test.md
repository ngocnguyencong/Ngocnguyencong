# packages/billing/src/dodo.test.ts

> Last updated: 2026-09-25 | Protection: STANDARD

## Purpose

Offline unit tests for `DodoBillingAdapter` (7) — fake
`DodoBillingClient` double; real Standard Webhooks HMAC payloads packed
via `encodeStandardWebhookSignature`.

## Coverage

- Checkout: `product_cart`/quantity, `return_url` ← `successUrl`, email +
  `metadata` {workspaceId, entitlement, priceId} passthrough.
- Portal: `createCustomerPortalLink` → `{url}`; null url throws.
- Webhook: `whsec_`-prefixed and literal secrets both verify;
  `subscription.cancelled` maps inactive with `metadata` workspace
  binding; stale timestamp rejects; tampered signature rejects; missing
  `data` rejects; `payment.succeeded` without `subscription_id` falls
  back to `payment_id` as the stable billing entity.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-25 | Initial tests (phase B5) | Devin |
