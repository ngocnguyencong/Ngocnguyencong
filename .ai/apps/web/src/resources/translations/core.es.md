# core.es.json

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Positional Spanish translations for the frozen English core docs catalog.

## Important Notes / NEVER Change

- Keep this as a JSON array of exactly 977 strings in the same order as `core.en.json`.
- Translate every human-readable title, paragraph, item and label. Preserve technical identifiers, inline code and Markdown links exactly.
- Keep `core.en.json` as the canonical source order; add translations whenever source content grows.
- Entry 15 translates `Set up in 5 minutes` as `Configuración en 5 minutos`.

## Open Threads / Resume Context

- **Status:** complete
- **Result:** all 977 entries are translated and non-empty.
- **Verification:** every source inline-code token and Markdown href is present at the matching index; the array has 977 entries and includes the Expo/Tauri five-minute headings and configured RevenueCat/store-acceptance policy update.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Completed the Spanish core documentation catalog and localized the platform quickstart/content additions | Codex |

2026-10-02: Formatting normalized during final documentation checks; content and structural identifiers preserved.

2026-10-04: aligned generic text-only demo branding and social-preview paths. Preserve source-array order across all locales.

2026-10-06: retranslated the three replaced source entries (upstream-repository paragraph now org-neutral with `upstream` remote + `<org>` placeholder URL; "vendedor"-vocabulary dropped from the commerce-boundary and agent-memory entries); array order unchanged.

2026-10-07: retranslated the observability logger entry in place for static messages, key-based redaction of structured context, and the prohibition on raw request bodies, credentials, environment-variable values, and URLs; array order unchanged.

2026-10-13: retranslated/replaced the localhost quickstart and locale-route test entries whose sources now reference the AI task console at `/ai`; array order unchanged.
