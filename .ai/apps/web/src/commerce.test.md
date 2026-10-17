# src/commerce.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Unit tests for `commerce.ts` domain logic plus source-contract assertions
for `commerce-actions.ts`.

## Coverage

- `parsePriceCents` integer/decimal forms, rejects junk/negatives/overflow.
- `evaluateOrderStatusChange` enforces the forward-only lifecycle
  (pending→paid→fulfilled; cancel pre-payment, refund post-payment).
- `normalizeCommerceProductInput` / `normalizeOrderItems` /
  `normalizeCustomerEmail` validation; `computeOrderTotalCents` uses
  server product prices; `formatCents` renders currency.
- Source contract: `requireWorkspaceManager` on every action,
  `eq(table.workspaceId, …)` scoping, product/order audit actions,
  `commerce.order_created` / `commerce.order_status_changed` webhooks,
  `revalidatePath("/commerce")`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-22 | Created | Devin |
