# app/paywall.tsx

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Paywall loads server purchase availability and the native RevenueCat SDK only
when the selected platform has its public key and the app provider is
`revenuecat`. It configures/logs in with the server-returned workspace app user
ID for every serialized store operation. Purchase and restore both POST an
empty body to server sync, then refresh the server-owned entitlement. If
verification is pending after a completed store purchase, the screen blocks
another purchase and offers restore/retry. Explicit development `fake` mode
simulates UI only and grants no access; the default provider is `off`. Native
plans use fixed Apple/Google subscription-management destinations; web billing
is a separate action. Screen colors use the active mobile theme palette.

## Important Notes / NEVER Change

- Never expose Stripe Checkout in the mobile app.
- Never treat client-side store customer info as the entitlement source of truth.
- Actual StoreKit/Play Billing verification requires an iOS or Android EAS native build; Expo Go cannot verify purchases.
- Native subscriptions must link to the store account; web billing cannot cancel a store transaction.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Add configured RevenueCat and server sync flows | Codex |
| 2026-10-01 | Theme paywall and separate native store management from web billing | Codex |
