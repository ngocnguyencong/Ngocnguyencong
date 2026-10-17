# apps/web/src/theme/styles.test.ts

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Unit tests for `theme/styles.ts` (`STYLE_CATALOG`, `styleById`,
`isStyleId`).

## Coverage

- ≥8 distinct styles incl. required ids; the configured `DEFAULT_STYLE_ID` is
  valid (do not pin a product's editable default to one particular style).
- Every style's axis values resolve to real catalog ids (theme,
  density, radius, font, layout, toastStyle) + non-empty copy.
- Light+dark pack coverage and >1 layout across the catalog.
- `styleById` fallback to default; `isStyleId` guard.
- Pins the four newly added style IDs and their complete axis bundles,
  including the `collapsible` layout ID supplied by the shell integration.
- Keeps the default-style test generic and ensure
  `obsidian-studio` remains the configured default.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-06 | Cover the four bundled theme/style-axis combinations | Codex |
| 2026-09-22 | Assert `toastStyle` resolves per style | Devin |
