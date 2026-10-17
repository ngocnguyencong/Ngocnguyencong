# packages/billing/src/paddle.ts

> Last updated: 2026-09-25 | Protection: STANDARD

## Purpose

Paddle (Merchant of Record) billing adapter — shares the framework-neutral
BFF contract (`createCheckoutSession` / `createPortalSession` /
`verifySignedWebhook`) over the shared entitlement-ledger types in
`./index.ts`, mirroring `creem.ts`/`polar.ts`.

## Behavior

- `PaddleBillingClient` is the injected minimal surface; the fetch-backed
  implementation lives in the web composition root
  (`createPaddleClient` — `POST {base}/transactions` and
  `POST /customers/{id}/portal-sessions`, `Authorization: Bearer`,
  `Paddle-Version: 1`).
- Checkout: `transactions.create` with `items: [{priceId, quantity}]`,
  `custom_data {workspaceId, entitlement, priceId}`, `customer.email`.
  Paddle checkouts redirect per the account's Paddle checkout settings — there is no
  per-transaction success-url field, so `successUrl` is intentionally not
  forwarded (documented deviation).
- Portal: `customers/{id}/portal-sessions` → `urls.general.overview`.
- Webhooks: `Paddle-Signature` header (`ts=<unix>;h1=<hex>`, extra `h1`
  parts allowed) verified locally — HMAC-SHA256 hex over
  `ts:payload` with `PADDLE_WEBHOOK_SECRET`, `timingSafeEqual` per
  candidate.
- Event mapping: `transaction.completed|paid` → active;
  `transaction.payment_failed|past_due` → past_due; approved refund/
  chargeback `adjustment.*` → inactive; `subscription.*` syncs on
  `data.status` (paused/canceled → inactive). Subscription id prefers
  `data.subscription_id`, else `data.id` on subscription./transaction.
  events, else `data.transaction_id` (adjustments).

## Dependencies

- Composition: `apps/web/src/server-provider-composition.ts`; runtime
  wiring `apps/web/src/billing-runtime.ts`; route
  `app/api/billing/webhook/paddle/route.ts`. Config/envs:
  `PADDLE_API_KEY`, `PADDLE_PRICE_ID{,_PRO,_PRO_YEARLY,_LIFETIME}`,
  `PADDLE_ENVIRONMENT` (sandbox|production), `PADDLE_WEBHOOK_SECRET`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-25 | Initial adapter (phase B5) | Devin |
