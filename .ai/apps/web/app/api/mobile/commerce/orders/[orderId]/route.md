# app/api/mobile/commerce/orders/[orderId]/route.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Order lifecycle endpoint for the mobile commerce surface — reuses
`setCommerceOrderStatusAction` from `src/commerce-actions.ts`.

## What It Does

- `PATCH {status}` — status ∈ `pending|paid|fulfilled|cancelled|refunded`
  (else 400) is bridged to the action via a route-built
  `FormData{orderId,status}` → 200 `{ok:true}`. Legal transitions are
  forward-only (`pending→paid→fulfilled`, plus pre-payment `cancelled`
  and post-payment `refunded` branches) and enforced inside the action
  via `evaluateOrderStatusChange`; illegal/unchanged transitions no-op
  silently. Cancelling restocks tracked inventory.
- `requireWorkspaceManager` runs first (401/403) so unauthenticated
  requests never consume the body; bounded JSON.

## Dependencies

- `src/commerce-actions.ts`, `src/commerce.ts` (`isCommerceOrderStatus`),
  `src/request-body.ts`, `src/workspace-access.ts`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-12 | Created | Devin |
