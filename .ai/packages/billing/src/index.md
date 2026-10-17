# packages/billing/src/index.ts

> Last updated: 2026-09-25 | Protection: STANDARD

## Purpose

Shared billing contract + barrel — the provider-neutral request/
verification/event types (`StripeCheckoutRequest`,
`SignedStripeWebhookVerification`, `VerifiedStripeBillingEvent`, …),
`LocalBillingService` (dev provider), and re-exports of every adapter:
`stripe`, `lemonsqueezy`, `creem`, `polar`, `whop`, `paddle`, `dodo`,
`paypal`, plus `standard-webhooks` helpers.

## Important Notes / NEVER Change

- Event/ledger types keep their historical `Stripe*` names — they are
  provider-neutral; `provider` namespaces rows in the DB.
- Adapters are framework-neutral; SDK/fetch clients are injected by the
  web composition root. Secrets never live in this package.
- Subscription webhook normalization prefers a current provider price/plan
  on the event object and uses checkout metadata as a compatibility fallback
  when the event carries no current price. Portal plan changes therefore
  update the persisted current plan reference.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-25 | Export paddle/dodo/paypal adapters (phase B5) | Devin |
