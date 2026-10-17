# apps/web/src/supadata/payments.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

parsePaymentInput, recordPayment (idempotent on site+externalId; visitor match by visitorRef → user_id → email; attribution copied from last-touch session; subscription → mrr interval normalization), normalizeProviderPayload for stripe/lemonsqueezy/polar/shopify/paddle/woocommerce/dodo-style webhooks.

## Important Notes / NEVER Change

- Refunds record negative amounts via kind="refund".
- Payments carry denormalized channel/source/medium/campaign so revenue breakdowns never need joins at read time.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
