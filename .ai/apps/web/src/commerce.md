# src/commerce.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Pure, client-safe domain logic for workspace commerce (`/commerce`) —
product/order statuses, the forward-only order lifecycle, money math in
integer minor units. No database or React imports.

## Behavior

- `COMMERCE_PRODUCT_STATUSES` = `draft | active | archived`.
- `COMMERCE_ORDER_STATUSES` = `pending | paid | fulfilled | cancelled |
  refunded`; `ORDER_TRANSITIONS` is forward-only: pending→paid/cancelled,
  paid→fulfilled/refunded, fulfilled→refunded. Terminal states have none.
- `parsePriceCents` accepts `"12"` or `"12.34"` → integer cents; ceiling
  `MAX_PRICE_CENTS` (~$1M) keeps values in int4.
- `normalizeCommerceProductInput` — name ≤ 160, slugified per-workspace
  slug, optional description ≤ 2_000, price in cents, ISO-4217 currency.
- `normalizeOrderItems` — productId+quantity lines (≤ `MAX_ORDER_QUANTITY`),
  rejects duplicates/unknowns; `computeOrderTotalCents` sums
  `unitPriceCents × quantity` from server-side product prices (never trusts
  client totals). `formatCents` renders via `Intl.NumberFormat`.

## Dependencies

- `./slug` — `slugify`.
- Consumers: `commerce-actions.ts`, `web-commerce-page.tsx`,
  `commerce.test.ts`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-22 | Created for workspace commerce (buyer requirement: products/orders) | Devin |
