# apps/web/src/theme/catalog.test.ts

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Coverage for `theme/catalog.ts` — the `THEME_CATALOG` color packs.

## Coverage

- Defaults to obsidian; ships many premade palettes; keeps the published
  obsidian black + amber identity.
- Every shared `theme.css` color token exposed per pack; missing/unknown
  ids fall back to obsidian.
- The minimal light pack ships its published tokens.
- Every pack serializes onto `html[data-theme]` and subtree
  `[data-theme]` wrappers.
- Asserts the four new packs are complete, light-scheme entries and
  verifies their stable IDs.
- contrast coverage computes WCAG ratios for text on page/section/
  raised surfaces, accent and button labels, focus rings, control borders, and
  semantic status foregrounds wherever those pairs are declared.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-06 | Expand pack and measured contrast coverage | Codex |
| 2026-09-27 | Minimal-pack assertions merged via feat/prod-ready-kit — initial mirror | Devin |
