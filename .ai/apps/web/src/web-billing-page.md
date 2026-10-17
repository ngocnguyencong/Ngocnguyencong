# web-billing-page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Client UI for `/billing` — product SaaS plan catalog (Free/Pro/Lifetime/Enterprise),
billing-period toggle, seat quantity stepper, Stripe Checkout/Portal handoff,
plus the prepaid workspace credits card.

## Behavior

- `BillingInterval` month/year toggle renders only when any plan has `yearly`.
- Seats: `−`/editable/`+` stepper — count is a real `<input type="text"
  inputMode="numeric">` (focus selects all; valid digits ≥1 apply live;
  invalid drafts hold last valid; blur/Enter commits, Escape reverts).
  Bounds `[1, MAX_BILLING_SEATS=999]` via `clampSeatCount`; helpers in
  `seat-count.ts`.
- Checkout POSTs `/api/billing/checkout` `{interval, planId, seats}` →
  redirects to provider URL; portal POSTs `/api/billing/portal`. Price IDs
  never leave the server (`resolveProductCheckout` + env price map).
- Plans render "Checkout ready" only when `stripeEnabled` and the price key
  is configured; free = local note, enterprise = sales note.
- `WorkspaceCreditsCard` fetches `/api/workspace/credits` client-side,
  renders the balance plus the last `CREDIT_HISTORY_ROWS` (10) ledger
  entries (kind badge via the `billing.credits.kinds` dictionary, signed
  amount, localized date, reason); a failed fetch hides the card
  entirely — billing management stays usable without the credits read.

## Dependencies

- `./product-plans` — `PRODUCT_PLANS`, `BillingInterval`, `ProductPlanId`.
- `./seat-count` — `sanitizeSeatInput`, `parseSeatInput`, `clampSeatCount`.
- `./app-chrome` — `WorkspaceShell`.
- `app/globals.css` `.seat-stepper` — stepper layout/styles.

## Important Notes / NEVER Change

- Keep checkout URLs server-derived; never embed price IDs client-side.
- Product SaaS billing only — no license/kit-order concepts here.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-10-16 | +"Usage & limits" link to `/settings/usage` (workspace usage controls live under Settings, not the billing page) | Devin |
| 2026-10-12 | Ledger rows validated per-field (`toCreditLedgerRow`) instead of a blind cast — malformed rows drop instead of rendering Invalid Date; `referenceId` no longer in the row type | Devin |
| 2026-10-11 | `WorkspaceCreditsCard` — prepaid balance + recent ledger from `/api/workspace/credits`, localized via `billing.credits` | Devin |
| 2026-09-20 | Seats `type="number"` field → −/editable/+ stepper (`seat-count.ts`, `.seat-stepper` CSS); max 999 kept | Devin |
