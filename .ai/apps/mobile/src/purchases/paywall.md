# src/purchases/paywall.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Cross-platform paywall reducer, presentation states, safe development-only
fake provider, and RevenueCat adapter. RevenueCat operations require a server
app user ID and run inside the serialized identity queue. Purchase/restore
results do not expose client-reported entitlements.

## Important Notes / NEVER Change

- Stripe Checkout is never a mobile purchase path.
- A client-reported RevenueCat entitlement must never grant workspace access; sync and refresh through the server after purchase or restore.
- The fake provider is opt-in for development and tests only.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Add RevenueCat identity and server-authoritative operations | Codex |
