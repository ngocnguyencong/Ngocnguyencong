# providers.fr.json

## Purpose

Source-string translations for every human-facing field in provider-guides.ts.

## Completed Content

- The fr map contains 89 exact English source-string keys covering all 23 titles, descriptions, groups, section headings, paragraphs, and link labels/descriptions.
- Every key has a complete localized value. Inline code delimiters are preserved where the source uses them.
- The map contains no code examples, slugs, section IDs, or hrefs; those remain shared across locales.

## Important Notes

- This JSON is data for the docs localization layer. Rendering and layout belong to the docs UI owner.
- Provider identifiers and placeholders stay intact inside translated prose.
- The map must be updated alongside any later English edits to provider guide human-facing fields.

## Change History

- 2026-10-01 — Added and coverage-checked all 89 provider-guide source strings in fr.
- 2026-10-02 — Plan: translate every new human-facing provider-guide source string added in the beginner setup pass; preserve exact English source keys, provider identifiers, code literals, slugs, section IDs, and URLs.

## Open Threads

- **Status:** in_progress
- **Intent:** Keep fr complete for the expanded provider guides.
- **Next steps:** Add a natural French translation for each new exact English source key and update the final key/coverage count.
- **Blockers / notes:** Source owns code blocks, slugs, section IDs, and hrefs; do not translate or modify those values.

## 2026-10-04 — AWS SES

AWS SES setup guidance covers verified identity/region/sandbox, classic IAM SMTP creation/management links, separate API keys or roles/session tokens, SMTP STARTTLS, all-platform server-only configuration, and current Mail Manager pricing. The optional open/mTLS endpoint fee is $50/month; authenticated endpoints are currently complimentary. Guide links, localized overlays and environment inventories stay aligned.

2026-10-13: rekeyed route-reference entries whose English sources now point to `/ai` — the provider test/sandbox dashboard guidance and the `/ai`-only no-database reference-screen note; values retranslated to match.
