# app/api/mobile/commerce/orders/route.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Mobile BFF order list (`/commerce` twin) — reuses `listCommerceOrders`
from `src/commerce-actions.ts` (owner/admin). Orders are created by
checkout flows, so there is intentionally no POST.

## What It Does

- `GET` → `{orders, manageable}`; `createdAt` serializes to ISO and each
  order carries its line items (`items[]` with productName/quantity/
  unitPriceCents). Error result maps to 401 or 403.

## Dependencies

- `src/commerce-actions.ts`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-12 | Created | Devin |
