# packages/billing/src/lemonsqueezy.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Unit tests for `LemonSqueezyBillingAdapter` — fake
`LemonSqueezyBillingClient` double; real HMAC-SHA256 `X-Signature`
hex over the raw payload, no network.

## Coverage

- Checkout translation: variantId/quantity/checkout_data custom +
  email/product_options redirect_url.
- `X-Signature` verification: accepts valid hex, rejects bad signatures.
- Signature hardening: malformed (non-hex, empty, wrong-length) and
  well-formed-but-wrong 64-hex signatures reject without throwing;
  non-string `payload`/`signature`/`webhookSecret` at runtime (cast
  through `as unknown as SignedStripeWebhookRequest`) reject without
  throwing; a `null` input rejects without throwing.
- Lifecycle mapping: status map on subscription_updated; paid
  order_created → active; payment failed/success/expired/cancelled
  statuses; unrelated events → ignored (null).
- A subscription's current variant id overrides stale checkout custom data
  when the adapter normalizes `priceId`.
- Portal session URL passthrough.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Added null-input rejection case | Devin |
| 2026-09-27 | Added signature-hardening cases (malformed/wrong hex, non-string runtime inputs); mirror doc created | Devin |
| 2026-09-19 | Created | Devin |
