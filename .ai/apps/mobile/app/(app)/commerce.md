# app/(app)/commerce.tsx

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Commerce screen — a Products/Orders pane toggle (same pattern as
`settings/developers.tsx`), owner/admin only server-side (the list
endpoints 403 for members, surfaced via `ErrorText`).

- **Products** — create/edit form (name, slug, decimal price like
  "12.99", currency blank→usd, inventory blank→untracked) and rows with
  price/stock detail, status badge, Activate/Set-draft + Archive buttons
  and an Edit affordance that prefills the form. Updates send the full
  field set — hidden `description`/`imageUrl` ride along from the loaded
  row so an edit cannot silently clear them (server normalizes the whole
  draft).
- **Orders** — rows show customer email, id, `formatCents` total, date,
  and line-item summary; per-row buttons come from
  `allowedOrderTransitions(status)` (the forward-only lifecycle mirror:
  pending→paid→fulfilled, cancel pre-payment, refund post-payment) with
  the web's action labels. Terminal orders render no controls.

## What It Does

- `createMobileCommerceActions(api)` — `products.{list,create,update,
  setStatus}`, `orders.{list,setStatus}`; the shared `run` helper sets
  busy/message/error then reloads. Pane spinners only show while the
  pane state is null AND no error is set — a failed load (member 403 or
  network) surfaces `ErrorText`; a partial failure keeps the error
  visible rather than clearing it.
- Reached via the home Quick actions card (`/commerce`); declared in
  `(app)/_layout.tsx` with `href: null` so it stays out of the tab bar.

## Dependencies

- `src/commerce/client.ts`, `src/session/provider.ts`,
  `src/ui/screen.tsx` primitives.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Products/orders lists read through `readCachedOrFetch`; `<OfflineNotice>` on cache source | Devin |
| 2026-10-12 | Created | Devin |
