# packages/billing/src/polar.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Polar (Merchant of Record) billing adapter — shares the framework-neutral
BFF contract (`createCheckoutSession` / `createPortalSession` /
`verifySignedWebhook`) over the shared entitlement-ledger types in
`./index.ts`, mirroring `creem.ts`.

## Behavior

- `PolarBillingClient` is the injected minimal surface; the SDK-backed
  implementation lives in the web composition root
  (`createPolarClient` → `new Polar({ accessToken, server })` from
  `@polar-sh/sdk`).
- Checkout: `checkouts.create` with `products: [productId]`,
  `metadata { workspaceId, entitlement, priceId }`, `successUrl`,
  `customerEmail`, `externalCustomerId: workspaceId`.
- Portal: `customerSessions.create` → `customerPortalUrl`.
- Webhooks: `validateEvent` from `@polar-sh/sdk/webhooks` (Standard
  Webhooks — raw body + `webhook-*` headers + `POLAR_WEBHOOK_SECRET`).
- Event mapping onto the shared ledger: `order.paid` → active;
  `subscription.active|updated` map `data.status`; `subscription.canceled
  |revoked` → canceled/inactive; `subscription.uncanceled` → reactivated;
  `order.refunded` → inactive. Seat quantity is ignored for product types
  Polar does not seat-meter (documented deviation).
- Normalized `priceId` prefers current `data.productId` or nested
  `data.product.id`, then falls back to metadata for older events without a
  current product value.

## Dependencies

- Composition: `apps/web/src/server-provider-composition.ts`; runtime
  wiring `apps/web/src/billing-runtime.ts`; route
  `app/api/billing/webhook/polar/route.ts`. Config/envs:
  `POLAR_ACCESS_TOKEN`, `POLAR_PRODUCT_ID{,_PRO,_PRO_YEARLY,_LIFETIME}`,
  `POLAR_SERVER` (sandbox|production), `POLAR_WEBHOOK_SECRET`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial adapter (phase B1) | Devin |
