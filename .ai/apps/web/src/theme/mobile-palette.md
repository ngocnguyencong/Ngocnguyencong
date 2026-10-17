# src/theme/mobile-palette.ts

> Last updated: 2026-10-15 | Protection: STANDARD

## Purpose

Pure mapping from a web `ThemeDefinition` (THEME_CATALOG pack) onto the
React Native `ThemePalette` contract — `mobileAppearancePacks()` ships
one `{id, name, colorScheme, palette}` entry per pack to the
`/api/mobile/appearance` BFF so mobile can paint the user's synced pack.

## Important Notes

- Field map: canvas=`--page`, canvasRaised=`--raised`, inputBackground=
  `--section`, ink=`--text`, muted=`--muted`, outline=`--border`,
  controlBorder=`--control-border`, signal=`--accent`, onSignal=
  `--accent-ink`, telemetry=`--info`, telemetrySoft=`--info-soft`,
  destructive=`--danger`, status=`semanticStatusColors[colorScheme]`.
- Mobile palettes carry only opaque `#rrggbb`; translucent web tokens
  (e.g. `rgba()` `--border`) are flattened by compositing over `--page`.
- `signalSoft` = accent mixed 16% over `--page` — the same tinted-surface
  recipe `catalog.ts` uses.
- A token that can't be normalized keeps its raw string (and a missing
  token emits `""`) so mobile-side hex validation drops the malformed
  pack instead of painting a guessed color.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | Created for cross-device appearance sync (WP1) | Devin |
