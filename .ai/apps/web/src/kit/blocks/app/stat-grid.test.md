# apps/web/src/kit/blocks/app/stat-grid.test.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Render tests (`renderToStaticMarkup`) for `StatGrid` deltas: good direction
gets the success tone, bad gets danger, small changes (`|change| < 0.005`)
and `null` render the flat "—" chip, and every delta carries the
visually-hidden "vs previous period" text.

## Important Notes / NEVER Change

- None.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Added for WP4 StatGrid delta coverage | Devin |
