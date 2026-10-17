# packages/billing/src/lemonsqueezy.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Second supported billing provider — Lemon Squeezy, a Merchant of Record.
Shares the framework-neutral BFF contract with the Stripe adapter:
`createCheckoutSession` / `createPortalSession` / `verifySignedWebhook`
over the shared entitlement-ledger types in `./index.ts`.

## Behavior

- `LemonSqueezyBillingClient` is the injected minimal surface; the
  fetch-backed implementation lives in the web composition root
  (`createLemonSqueezyClient` — JSON:API `api.lemonsqueezy.com/v1`,
  `Authorization: Bearer`).
- `createCheckoutSession` maps to `POST /checkouts` (`variantId` =
  priceId via relationships, `quantity` = seats clamped 1–999,
  `checkout_data.custom` = {workspaceId, entitlement, priceId},
  `checkout_data.email`, `product_options.redirect_url` = successUrl,
  `relationships.store` = `LEMONSQUEEZY_STORE_ID`).
- `createPortalSession` maps to `GET /customers/{id}` → customer portal
  URL; a null URL throws.
- `verifySignedWebhook` verifies the `X-Signature` header = HMAC-SHA256
  hex of the raw body with `LEMONSQUEEZY_WEBHOOK_SECRET` (timing-safe
  compare). A null / non-object input, runtime non-string `payload`/
  `signature`/`webhookSecret`, or a throwing HMAC digest rejects cleanly
  instead of surfacing as a webhook-endpoint 500; malformed signatures
  compare against a zero-filled buffer of the expected length so
  `timingSafeEqual` always runs on equal-length buffers — no
  secret-dependent timing distinction (any delta depends only on
  attacker-controlled input format) and no length-mismatch throw (same
  hardening style as `paddle.ts`/`dodo.ts`).
- Payload shape: `{ data: {id, type, attributes}, meta: {event_name,
  custom_data} }`. `custom_data` echoes {workspaceId, entitlement,
  priceId}; `subscriptionId` set when `data.type === "subscriptions"`;
  eventId = `event_name:data.id:occurredAt`.
- Normalized `priceId` prefers current `data.attributes.variant_id`
  (stringified) and falls back to custom data for older or non-subscription
  events without a current variant.
- Entitlement mapping: `order_created` (status `paid`) → active;
  `subscription_payment_failed` → past_due;
  `subscription_payment_success`/`subscription_resumed` → active;
  `subscription_expired`/`subscription_cancelled` → inactive;
  `subscription_created`/`subscription_updated` map `attributes.status`
  (on_trial → trialing, active → active, past_due/unpaid → past_due,
  cancelled/expired/paused → inactive); other events → ignored (null).

## Dependencies

- Composition: `apps/web/src/server-provider-composition.ts`
  (`createLemonSqueezyClient`); runtime wiring
  `apps/web/src/billing-runtime.ts` (`lemonSqueezyBillingBff`); route
  `app/api/billing/webhook/lemonsqueezy/route.ts`. Config/envs:
  `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`,
  `LEMONSQUEEZY_VARIANT_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Follow-up: first-check null/non-object input guard before field access; comment tightened to "no secret-dependent timing distinction" | Devin |
| 2026-09-27 | Hardened `verifySignedWebhook`: typeof guards on payload/signature/webhookSecret, digest try/catch, equal-length constant-time compare for malformed signatures; mirror doc created | Devin |
| 2026-09-19 | Initial adapter — second billing provider | Devin |
