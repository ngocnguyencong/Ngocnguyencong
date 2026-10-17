# src/purchases/config.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Resolves the explicit mobile purchase provider and platform public SDK key.
Purchases default to off; fake mode is development-only.

## Important Notes / NEVER Change

- Missing or invalid configuration must disable buying safely.
- Never accept fake mode for a production build.
- RevenueCat is enabled only for iOS or Android with that platform's public SDK key.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Default off; gate real/fake providers by build and platform key | Codex |
