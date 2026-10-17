# packages/billing/src/paypal.ts

> Last updated: 2026-09-25 | Protection: STANDARD

## Purpose

PayPal subscriptions adapter — shares the framework-neutral BFF contract
(`createCheckoutSession` / `createPortalSession` / `verifySignedWebhook`)
over the shared entitlement-ledger types in `./index.ts`. Unlike the
other providers, PayPal has no local signature scheme: webhook
verification is a server call, so `verifySignedWebhook` is async.

## Behavior

- Five `PayPal-*` transmission headers are packed into the single
  `signature` contract field — routes call
  `encodePaypalWebhookSignature` (JSON), the adapter recovers them with
  `decodePaypalWebhookSignature`.
- `PaypalBillingClient` is the injected minimal surface; the fetch-backed
  OAuth client lives in the web composition root (`createPaypalClient` —
  `POST /v1/oauth2/token` client-credentials grant, `POST
  /v1/billing/subscriptions`, `POST
  /v1/notifications/verify-webhook-signature`; sandbox vs live base URL
  from `PAYPAL_ENVIRONMENT`).
- Checkout: `billing/subscriptions` with `plan_id`, `custom_id` =
  compact JSON `{e:entitlement, p:priceId, w:workspaceId}` (127-char cap
  enforced), `application_context` return/cancel URLs, optional
  `subscriber.email_address`. PayPal subscriptions are per-subscriber —
  `seats`/`customerId` are ignored (documented deviation).
- Portal: resolves to `https://www.{sandbox.}paypal.com/myaccount/autopay/`
  (PayPal's hosted autopay self-service; no API portal exists).
- Webhook verify: `POST verify-webhook-signature` with the five
  transmission headers + `webhook_id` (rides the `webhookSecret` slot)
  + parsed event → `verification_status === "SUCCESS"` required.
- Event mapping: `BILLING.SUBSCRIPTION.ACTIVATED`/`PAYMENT.SALE.COMPLETED`
  → active; `BILLING.SUBSCRIPTION.CANCELLED|EXPIRED|SUSPENDED` → inactive;
  `PAYMENT.SALE.DENIED` → past_due. `resource.billing_agreement_id` or
  `resource.id` supplies `subscriptionId`; `resource.custom_id` JSON
  supplies workspace binding; `subscriber.payer_id`/`payer.payer_id`/
  subscriptionId supplies `customerId` (billing identity must exist so
  the portal unlocks).

## Dependencies

- Composition: `apps/web/src/server-provider-composition.ts`; runtime
  wiring `apps/web/src/billing-runtime.ts`; route
  `app/api/billing/webhook/paypal/route.ts`. Config/envs:
  `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
  `PAYPAL_PLAN_ID{,_PRO,_PRO_YEARLY,_LIFETIME}`, `PAYPAL_WEBHOOK_ID`,
  `PAYPAL_ENVIRONMENT` (sandbox|live). `billing-bff.ts` awaits
  `verifySignedWebhook` for async providers.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-25 | Initial adapter (phase B5) | Devin |
