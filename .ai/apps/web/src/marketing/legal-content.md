# src/marketing/legal-content.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Base (English) legal documents for the marketing surface: `privacyPolicy`,
`termsOfUse`, `licenseAgreement`, `acceptableUsePolicy`, and `disclaimer`.
`legalDocument(slug)` resolves a `LegalSlug` ("privacy" | "terms" | "license" |
"acceptable-use" | "disclaimer") to its document; each page under `app/`
renders its document through `legal-page.tsx`.

## Important Notes

- `LegalSection.items` is optional — the license page's "can/can't" bullet
  lists ride on it; privacy/terms stay paragraph-only.
- Copy rules are enforced by `legal-content.test.ts`: no invented
  certifications, customer proof, or support promises; the license document
  describes the license shape (grant, seats concept, revocation) without
  purchase or repository-delivery mechanics.
- `updated` uses an ISO date rendered via `formatUpdated` in legal-page.tsx.
- Terms describe the mobile technical boundary directly: native purchase and
  restore use RevenueCat, and workspace access follows server-verified
  entitlements. Web billing remains a separate surface.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Comment above `licenseAgreement` points at the repo-root `LICENSE.md` it mirrors | Devin |
| 2026-09-27 | Added `license` slug + `licenseAgreement` (grant/can/can't/seats/revocation) and optional `LegalSection.items` | Devin |
| 2026-09-27 | Added `acceptable-use` + `disclaimer` slugs with generic product wording, guarded by a copy regression test | Devin |
| 2026-10-01 | Updated the terms' mobile-purchases policy to the current RevenueCat and server-verification flow | Codex |
