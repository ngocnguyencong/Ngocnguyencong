# packages/billing/src/creem.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Unit tests for `CreemBillingAdapter` — mirrors `lemonsqueezy.test.ts`
conventions (real HMAC-SHA256 signatures over the raw payload, no network).

## Coverage

- Checkout translation: product_id/units/request_id/metadata/customer email.
- `creem-signature` verification: accepts valid hex, rejects bad signatures.
- Signature hardening: malformed (non-hex, empty, wrong-length) and
  well-formed-but-wrong 64-hex signatures reject without throwing;
  non-string `payload`/`signature`/`webhookSecret` at runtime (cast
  through `as unknown as SignedStripeWebhookRequest`) reject without
  throwing; a `null` input rejects without throwing.
- Lifecycle mapping: status map on subscription.update; checkout.completed →
  active; paid/past_due/unpaid/canceled/expired/paused/refund statuses;
  scheduled_cancel + dispute → ignored (null).
- A subscription's current product id overrides stale checkout metadata when
  the adapter normalizes `priceId`.
- Portal session URL passthrough.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-27 | Added null-input rejection case | Devin |
| 2026-09-27 | Added signature-hardening cases (malformed/wrong hex, non-string runtime inputs) | Devin |
| 2026-09-22 | Created | Devin |
