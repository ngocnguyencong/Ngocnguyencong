# src/purchases/revenuecat-sdk.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Adapts the native RevenueCat SDK to the purchase provider boundary and keeps a
process-wide serialized identity manager.

The paywall dynamically imports this adapter only when RevenueCat is selected
and configured. It keeps one adapter per public platform key so native SDK
configuration is process-wide. The adapter maps the current offering to app
package rows and resolves a selected package before purchase.

## Important Notes / NEVER Change

- RevenueCat customer info does not grant access; the server sync endpoint does.
- A native development/EAS build is required to verify store SDK calls.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Add native SDK configuration, offering, purchase, and restore adapter | Codex |
