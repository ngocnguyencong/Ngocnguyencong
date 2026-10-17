# app/(app)/settings/billing.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Billing section: current plan (entitlement + workspace plan fallback),
monthly usage, prepaid workspace credits (balance + recent ledger via
`createMobileCreditsActions` → `GET /api/mobile/credits`), and a paywall
link. Purchase availability depends on the app build, server RevenueCat
configuration, and owner/admin workspace role. It describes recorded
entitlement expiry without implying renewal and clarifies that native
store subscriptions and web billing are managed separately. The screen
does not expose Stripe Checkout.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Credits/usage reads through `readCachedOrFetch`; `<OfflineNotice>` on cache source | Devin |
| 2026-10-16 | Read-only "Usage & limits" card (`createMobileUsageActions` → `GET /api/mobile/usage`): AI spend vs budget with progress bar, per-meter used/limit, "Manage limits on the web app." | Devin |
| 2026-10-11 | Credits card — balance + recent ledger loaded alongside entitlement/metrics | Devin |
| 2026-09-28 | Created | Devin |
| 2026-10-01 | Update purchase availability guidance | Codex |
| 2026-10-01 | Clarify entitlement expiry and store versus web cancellation | Codex |
