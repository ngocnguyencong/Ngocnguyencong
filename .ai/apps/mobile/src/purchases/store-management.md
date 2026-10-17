# src/purchases/store-management.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Maps supported native platforms to fixed trusted store subscription management destinations.

## Important Notes / NEVER Change

- Use hard-coded HTTPS Apple App Store and Google Play account URLs; never derive management destinations from untrusted input.
- Web billing is a separate channel and cannot cancel a native store subscription.

The paywall exposes the matching store action on iOS and Android and keeps web
billing as a separate option. Unsupported platforms have no store URL.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Add fixed Apple and Google subscription management destinations | Codex |
