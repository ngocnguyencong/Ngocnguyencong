# packages/billing/src/paypal.test.ts

> Last updated: 2026-09-25 | Protection: STANDARD

## Purpose

Offline unit tests for `PaypalBillingAdapter` +
`encodePaypalWebhookSignature`/`decodePaypalWebhookSignature` (7) — fake
`PaypalBillingClient` double; no real OAuth or verify calls.

## Coverage

- Signature packing round-trip; decode rejects malformed/missing-header
  payloads.
- Checkout: `plan_id`, compact `custom_id` JSON {e,p,w}, return/cancel
  URLs, email passthrough; 127-char `custom_id` cap throws.
- Portal: autopay URL passthrough; null url throws.
- Webhook: `verifyWebhookSignature` SUCCESS verifies + maps
  `BILLING.SUBSCRIPTION.ACTIVATED` with `custom_id` workspace binding;
  non-SUCCESS status rejects; client throw rejects; tampered/missing
  transmission headers reject; `PAYMENT.SALE.COMPLETED` uses
  `billing_agreement_id` as `subscriptionId` and `payer.payer_id` as
  `customerId`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-25 | Initial tests (phase B5) | Devin |
