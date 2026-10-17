# packages/billing/src/creem.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Third billing provider — Creem, a Merchant of Record (lower fees + lighter
application requirements than Stripe; comparable to Lemon Squeezy). Shares
the framework-neutral BFF contract: `createCheckoutSession` /
`createPortalSession` / `verifySignedWebhook` against the shared ledger
types in `./index.ts`.

## Behavior

- `createCheckoutSession` maps the shared `StripeCheckoutRequest` onto
  `POST /v1/checkouts` (`product_id` = priceId, `units` = seats clamped
  1–999, `request_id` = idempotency key, `customer.email`,
  `metadata` = {workspaceId, entitlement, priceId}, `success_url`).
- `createPortalSession` maps to `POST /v1/customers/billing` →
  `customer_portal_link` (Creem's hosted "my orders" portal).
- `verifySignedWebhook` verifies `creem-signature` = HMAC-SHA256 hex of the
  raw body with `CREEM_WEBHOOK_SECRET` (timing-safe compare). A null /
  non-object input, runtime non-string `payload`/`signature`/
  `webhookSecret`, or a throwing HMAC digest rejects cleanly instead of
  surfacing as a webhook-endpoint 500; malformed signatures compare
  against a zero-filled buffer of the expected length so
  `timingSafeEqual` always runs on equal-length buffers — no
  secret-dependent timing distinction (any delta depends only on
  attacker-controlled input format) and no length-mismatch throw (same
  hardening style as `paddle.ts`/`dodo.ts`).
- Payload shape: `{ id: "evt_*", eventType, created_at: <ms>, object }`.
  Metadata echoes at `object.metadata`; customer id at `object.customer.id`
  (or `object.customer` string / `object.order.customer`); subscription id
  = `object.id` when `object.object === "subscription"`.
- Normalized `priceId` prefers current `object.product_id` or nested
  `object.product.id`, then falls back to checkout metadata for older or
  payment events without a current product value.
- Entitlement mapping: `checkout.completed`/`subscription.paid` → active;
  `subscription.trialing` → trialing; `subscription.past_due|unpaid` →
  past_due; `subscription.canceled|expired|paused` + `refund.created` →
  inactive; `subscription.active|update` map `object.status`;
  `subscription.scheduled_cancel`/`dispute.created` → ignored (no grant
  change until period end / dispute resolution).

## Dependencies

- Composition root: `apps/web/src/server-provider-composition.ts`
  (`createCreemClient` — fetch, `x-api-key` auth, `CREEM_TEST_MODE` selects
  `test-api.creem.io`). Runtime wiring: `apps/web/src/billing-runtime.ts`
  (`creemBillingBff` → `activeBillingBff` fallback chain). Webhook route:
  `app/api/billing/webhook/creem/route.ts`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-27 | Follow-up: first-check null/non-object input guard before field access; comment tightened to "no secret-dependent timing distinction" | Devin |
| 2026-09-27 | Hardened `verifySignedWebhook`: typeof guards on payload/signature/webhookSecret, digest try/catch, equal-length constant-time compare for malformed signatures | Devin |
| 2026-09-22 | Created — third billing provider (user request: Creem as lower-fee MoR) | Devin |
