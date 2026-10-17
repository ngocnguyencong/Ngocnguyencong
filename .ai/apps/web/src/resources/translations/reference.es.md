# reference.es.json

## Purpose

Spanish translations for all human-facing strings in the English reference-guide source data.

## Important Notes

- JSON keys must exactly match English source strings so `docs-i18n.ts` can resolve them.
- Keep code, ids, slugs, URLs, HTTP paths, environment variable names, and other identifiers unchanged.

## Coverage

- **Status:** complete
- 300 exact source-string keys, including RevenueCat environment settings, local Postgres and MinIO Compose credentials, access explanations, and purchase sync/webhook route descriptions.
- Source-key coverage passes together with the complete Spanish core catalog; technical identifiers remain unchanged.

2026-10-04: replaced logo-preservation instructions with generic product customization and blank native icon guidance; aligned social-preview paths.
2026-10-07: added translations for the local Postgres and MinIO Compose credential descriptions.
2026-10-10: added translations for the api-routes guide's /api-reference link (label + description).
2026-10-12: added translations for the mobile commerce/content route rows and the updated mobile-route access paragraph.

2026-10-16: added translations for the four new api-routes purpose strings (account + mobile appearance, mobile usage, workspace export).
