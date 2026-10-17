# apps/mobile/src/commerce/client.test.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Vitest coverage for `createMobileCommerceActions`,
`allowedOrderTransitions`, and `formatCents` over a stub
`MobileApiFetch` transport.

## What It Does

- `products.list` filters malformed/unknown-status rows, reads
  `manageable`; `create` unwraps `{id}`; `update`/`setStatus` PATCH the
  product route.
- `orders.list` drops orders with malformed `items`;
  `orders.setStatus` PATCHes `{status}`.
- `allowedOrderTransitions` pins the forward-only lifecycle mirror;
  `formatCents` covers Intl formatting + malformed-code fallback.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-12 | Created | Devin |
