# core.de.json

## Purpose

German values for the ordered source-string catalog in `core.en.json`.

## Planned Changes

- Translate all 977 source strings into German and preserve their array order exactly. (Complete.)
- Preserve technical names, environment keys, inline code, Markdown links, placeholders, and punctuation structures when they carry meaning.
- Translate the exact heading `Set up in 5 minutes` as `Einrichtung in 5 Minuten`.
- Work in durable batches and keep the array valid JSON after each batch; the final array contains exactly 977 translated entries.

## Important Notes

- The English source file is the canonical ordering; keep the German array aligned to it.
- Do not edit docs rendering or styles in this task.
- No tests or root source files are part of this content-only translation.

## Open Threads

- The source and mirror context were read. `core.de.json` contains all 977 entries in source order, including mobile product-surface, RevenueCat, chat-cancellation, platform quickstart, and configured store-purchase policy updates; inline-code tokens and Markdown links are preserved.

2026-10-02: Formatting normalized during final documentation checks; content and structural identifiers preserved.

2026-10-04: aligned generic text-only demo branding and social-preview paths. Preserve source-array order across all locales.

2026-10-06: retranslated the three replaced source entries (upstream-repository paragraph now org-neutral with `upstream` remote + `<org>` placeholder URL; "Verkäufer"-vocabulary dropped from the commerce-boundary and agent-memory entries → "Lizenzen"/"Lizenz-Fulfillment-Mechanik"); array order unchanged.

2026-10-07: retranslated the observability logger entry in place for static messages, key-based redaction of structured context, and the prohibition on raw request bodies, credentials, environment-variable values, and URLs; array order unchanged.

2026-10-13: retranslated/replaced the localhost quickstart and locale-route test entries whose sources now reference the AI task console at `/ai`; array order unchanged.
