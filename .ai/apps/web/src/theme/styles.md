# apps/web/src/theme/styles.ts

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

`STYLE_CATALOG` — the "pick a whole look" library. Each
`StyleDefinition` bundles every appearance axis at once:
`theme` + `density` + `radius` + `font` + `layout` + `toastStyle`.
`applyStyle(id)` applies all axes; `currentStyleId()` returns the
bundle id only while all six axes still match (else "" = custom mix).

## Important Notes

- `DEFAULT_STYLE_ID` is the startup source of truth for all six axes, including
  no-JavaScript rendering. Unknown style IDs fall back to that configured style.
  Editing the catalog alone changes options, not selection. Saved explicit
  visitor choices override the configured default.
- Adding an axis to `presets.ts` requires: `StyleDefinition` field,
  a pick per catalog style, `applyStyle` call, and the
  `currentStyleId` comparison — the tests enforce valid axis ids.
- Toast picks: `solid` for filled/dark styles, `outline` for
  editorial/ops/terminal minimalism, `soft` for soft/translucent
  aesthetics (blossom, harbor).
- Includes `ocean-workspace`, `lavender-studio`, `cobalt-console`, and
  `sand-editorial`, mapping each to the assigned theme, density, radius, font,
  layout, and toast-style axes. `DEFAULT_STYLE_ID` remains
  `obsidian-studio`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-06 | Add four bundled styles while retaining the configured default | Codex |
| 2026-09-24 | +`minimal-product` (minimal pack, comfortable, round, geometric, topnav, outline) — the light minimal marketing look | Devin |
| 2026-09-22 | +4 styles on the new packs: `amethyst-lounge`, `volt-lab`, `meadow-notes`, `porcelain-store` | Devin |
| 2026-09-22 | `StyleDefinition.toastStyle` + apply/currentStyleId wiring | Devin |
| 2026-10-16 | +5 styles: ember-forge, fjord-console, citrus-launch, mono-brutalist, sunset-journal | Devin |
