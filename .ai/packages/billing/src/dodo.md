# packages/billing/src/dodo.ts

> Last updated: 2026-09-25 | Protection: STANDARD

## Purpose

Dodo Payments (Merchant of Record) billing adapter — shares the
framework-neutral BFF contract (`createCheckoutSession` /
`createPortalSession` / `verifySignedWebhook`) over the shared
entitlement-ledger types in `./index.ts`, mirroring `whop.ts`.

## Behavior

- `DodoBillingClient` is the injected minimal surface; the fetch-backed
  implementation lives in the web composition root
  (`createDodoClient` — `POST {base}/checkouts` and
  `POST /customers/{id}/customer-portal/session`,
  `Authorization: Bearer`).
- Checkout: `checkouts` with `product_cart: [{product_id, quantity}]`,
  `return_url`, `customer.email`, `metadata {workspaceId, entitlement,
  priceId}`.
- Portal: `customers/{customer_id}/customer-portal/session` → `link`.
- Webhooks: Standard Webhooks — the three `webhook-{id,timestamp,
  signature}` headers travel inside the single `signature` field via
  `decodeStandardWebhookSignature`/`encodeStandardWebhookSignature`
  (same packing as polar/whop). Verified locally with plain
  HMAC-SHA256/base64 over `id.timestamp.payload`; 300s timestamp
  tolerance; `whsec_` base64 prefix on `DODO_PAYMENTS_WEBHOOK_KEY` is
  decoded when present, else the literal bytes are the key.
- Event mapping: `payment.succeeded`/`subscription.active|renewed` →
  active; `subscription.cancelled|expired` → inactive;
  `subscription.on_hold`/`payment.failed` → past_due. Subscription id
  prefers `data.subscription_id`, else `data.payment_id` on payment.*
  events, else `data.id`. Event id falls back to `webhook-id` when the
  payload has no `event_id`.

## Dependencies

- Composition: `apps/web/src/server-provider-composition.ts`; runtime
  wiring `apps/web/src/billing-runtime.ts`; route
  `app/api/billing/webhook/dodo/route.ts`. Config/envs:
  `DODO_PAYMENTS_API_KEY`, `DODO_PRODUCT_ID{,_PRO,_PRO_YEARLY,_LIFETIME}`,
  `DODO_PAYMENTS_ENVIRONMENT` (test_mode|live_mode),
  `DODO_PAYMENTS_WEBHOOK_KEY`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-25 | Initial adapter (phase B5) | Devin |
