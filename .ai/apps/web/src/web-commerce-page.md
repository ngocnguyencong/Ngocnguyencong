# src/web-commerce-page.tsx

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Client UI for `/commerce` (+ `/[locale]/commerce`) — workspace product and
order management. Two panels: product catalog (create/edit/status) and
orders (create from products, status transitions).

## Behavior

- Renders inside `WorkspaceShell`; loads via `listCommerceProducts` +
  `listCommerceOrders`.
- Order creation picks active products with quantities; totals shown via
  `formatCents`; next-status buttons come from `allowedOrderTransitions`
  so the UI can't offer an illegal transition.
- Products show optional inventory counts; the server enforces stock and
  restocks on cancel.
- Management is owner/admin — the manager-gate error renders as a
  read-only notice for members.
- Prices are display-only here; the server recomputes totals.

## Dependencies

- `./commerce` — statuses, `allowedOrderTransitions`, `formatCents`.
- `./commerce-actions` — server actions + row types.
- `./app-chrome` — `WorkspaceShell`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-22 | Created | Devin |

## UI foundation implementation (2026-10-06)

Shared accessible Select/Popover/Dialog behavior is integrated where applicable; shared chrome and appearance labels are localized. Workspace scope, server-authoritative actions, neutral sample content, and native form/essential reading fallbacks are preserved. Behavioral verification covers the shared primitives; live authenticated/provider flows remain outside local acceptance.
