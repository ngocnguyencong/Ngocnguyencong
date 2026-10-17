# app/api/mobile/commerce/products/[productId]/route.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Per-product mutations for the mobile commerce surface — reuses
`updateCommerceProductAction` / `setCommerceProductStatusAction` from
`src/commerce-actions.ts`. There is no delete action: `archived` is the
removal state.

## What It Does

- `PATCH` — composable JSON contract (owner/admin):
  - field keys `currency|description|imageUrl|inventory|name|price|slug`
    (strings) → `updateCommerceProductAction` (full-form replace:
    `name` + `price` required server-side);
  - `status` ∈ `draft|active|archived` → `setCommerceProductStatusAction`
    via a route-built `FormData{productId,status}` (free transitions;
    unchanged status is a silent no-op).
  - Both may combine (fields first). Update `{ok:false}` → 422 and skips
    the status leg; unknown status → 400; neither → 400.
- `requireWorkspaceManager` runs first (401/403) so unauthenticated
  requests never consume the body; bounded JSON.

## Dependencies

- `src/commerce-actions.ts`, `src/commerce.ts`
  (`isCommerceProductStatus`), `src/request-body.ts`,
  `src/workspace-access.ts`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-12 | Created | Devin |
