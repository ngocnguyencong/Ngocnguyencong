# Shared UI copy

Serializable English/German/Spanish/French dictionaries for appearance, chrome, and reusable control labels. Locale explicitly supplied by server surfaces; browser-only integrations read the locale cookie. Catalog display names remain identifiers; descriptions are localized.

2026-10-11: added `consent` section (banner `title`/`body`/`accept`/`reject` + footer `preferences` label) to all four dictionaries; `ConsentBanner`/`ConsentPreferencesButton` read it via `copyForLocale(locale)`.

2026-10-15: `copy.appearance` gained a quiet `syncNote` line ("Your appearance syncs to every device you sign in on.", translated in all four dictionaries) rendered under Settings → Appearance for signed-in users.
| 2026-10-16 | paletteDescriptions += ember/fjord/citrus/mono/sunset for de/es/fr | Devin |
