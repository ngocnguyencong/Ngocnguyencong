# Color pack catalog

Twenty-one packs, including Ocean, Lavender, Cobalt, and Sand light palettes. THEME_TOKEN_NAMES lists complete base, status, focus-ring, and control-border roles. generatedThemeTokens supplies scheme-specific semantic statuses without duplicating them in every pack; completeThemeCatalog preserves literal pack IDs. Existing catalog/boot/application APIs remain compatible.

Add `--accent-text`: preserve the original accent wherever it meets 4.5:1; otherwise mix it toward text until labels pass on plain and tinted surfaces. Keep action fills and primary-button labels intact. CSS colored text consumes this role with a legacy accent fallback; measured contracts include actual selected/tinted backgrounds.

Paper uses black text on its unchanged clay accent; light pack hover fills are dark enough for their existing labels. contrast.test measures text/muted/content against each surface, accent/button foregrounds in both states,3:1 required boundaries, and solid/soft status pairs. themeStylesheet paints html and pinned subtrees; an explicit locked marketing wrapper receives the complete Obsidian roles. Black default and browser-local preference semantics are preserved.
| 2026-10-16 | +5 packs: ember/fjord (dark), citrus/mono/sunset (light) — contrast-verified | Devin |
