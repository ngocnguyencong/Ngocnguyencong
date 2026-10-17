# src/commerce-actions.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`"use server"` actions for workspace commerce. All actions go through
`requireWorkspaceManager()` — commerce is owner/admin only (money data),
unlike content which allows member+.

## Behavior

- `listCommerceProducts()` / `listCommerceOrders()` — workspace-scoped
  lists for `/commerce`; orders join their items.
- `createCommerceProductAction` / `updateCommerceProductAction` /
  `setCommerceProductStatusAction` — slug uniqueness per workspace via the
  DB unique index (23505 → friendly error); products carry an optional
  `inventory` count; audit `commerce_product.created|updated|archived`.
- `createCommerceOrderAction` — takes `{productId, quantity}[]` + customer
  email; every line must reference an ACTIVE product in this workspace,
  all lines share one currency, and tracked (non-null) inventory rejects
  oversells. Prices/totals are recomputed server-side from the product
  rows — clients never submit prices. Tracked inventory decrements via
  `inventory - qty`; audit `commerce_order.created` + webhook
  `commerce.order_created`.
- `setCommerceOrderStatusAction` — `evaluateOrderStatusChange` gate on the
  current row, then update; cancelling restocks tracked inventory,
  refunds do NOT (goods may be gone); audit
  `commerce_order.status_changed` + webhook
  `commerce.order_status_changed`.
- Only async functions exported (server-action module contract — no
  re-exports of sync helpers). All mutations `revalidatePath("/commerce")`.

## Dependencies

- `./workspace-access` — `requireWorkspaceManager`.
- `./webhook-events` + `webhook-delivery` — `commerce.order_*` emits.
- `@supastack/db` — `commerceProduct`, `commerceOrder`,
  `commerceOrderItem`, `writeAuditEvent`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-27 | `isUniqueViolation` extracted into shared `./db-errors` (prod-ready-kit merge) | Devin |
| 2026-09-22 | Created | Devin |
