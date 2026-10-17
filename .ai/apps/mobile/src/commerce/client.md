# apps/mobile/src/commerce/client.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Typed mobile client for `/api/mobile/commerce/*` — the workspace product
catalog and order list plus status mutations shown on the Commerce
screen.

## What It Does

- `createMobileCommerceActions(api)` over the shared `MobileApiClient`:
  - `products.list()` → `{products, manageable}`; `create(fields)` →
    `{id}` (POST); `update(productId, fields)` (PATCH — full-form
    replace: `name` + `price` required server-side);
    `setStatus(productId, status)` (PATCH `{status}`).
  - `orders.list()` → `{orders, manageable}` (each order carries
    validated `items[]`); `setStatus(orderId, status)` (PATCH).
    No order create — orders come from checkout flows.
- Row validators drop malformed entries/orders rather than guessing
  (bad `items` invalidates the whole order — quantities and cents must
  never be fabricated).
- Exports status unions + `allowedOrderTransitions` (mirrors
  `ORDER_TRANSITIONS` in `apps/web/src/commerce.ts`: pending → paid →
  fulfilled, cancel pre-payment, refund post-payment) and `formatCents`
  (Intl with fallback) — keep both in sync with the web module.

## Dependencies

- `src/api/client.ts` — `MobileApiClient` (cookie auth + JSON envelope).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-12 | Created | Devin |
