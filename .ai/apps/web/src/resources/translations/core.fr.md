# core.fr.json

## Purpose

French translation of the ordered core/legacy guide catalog and docs group labels. The array mirrors `core.en.json` by index and keeps code, IDs, URLs, and source-path-only blocks structural.

## Important Notes

- Preserve the exact 977-entry source order; translate every human-readable string.
- Keep technical identifiers, inline code, and Markdown links intact.
- The five-minute heading uses the approved wording “Configuration en 5 minutes”.
- The French array contains all 977 translations, including mobile product-surface, RevenueCat, chat cancellation, Expo/Tauri quickstarts, and the configured store-purchase policy update.

## Open Threads

- **Status:** complete
- **Intent:** maintain complete French coverage in source order while preserving code tokens and links.
- **Next steps:** translate each future source addition and keep exact coverage checks passing.

## Planned Changes

- All 977 human-readable source entries are translated while preserving inline-code tokens, Markdown destinations, environment names, placeholders, and stable labels.
- The positional array is aligned exactly with `core.en.json`; update its matching mirror when source content changes.

2026-10-02: Formatting normalized during final documentation checks; content and structural identifiers preserved.

2026-10-04: aligned generic text-only demo branding and social-preview paths. Preserve source-array order across all locales.

2026-10-06: retranslated the three replaced source entries (upstream-repository paragraph now org-neutral with `upstream` remote + `<org>` placeholder URL; "vendeur"-vocabulary dropped from the commerce-boundary and agent-memory entries → "gestion des licences"); array order unchanged.

2026-10-07: retranslated the observability logger entry in place for static messages, key-based redaction of structured context, and the prohibition on raw request bodies, credentials, environment-variable values, and URLs; array order unchanged.

2026-10-13: retranslated/replaced the localhost quickstart and locale-route test entries whose sources now reference the AI task console at `/ai`; array order unchanged.
