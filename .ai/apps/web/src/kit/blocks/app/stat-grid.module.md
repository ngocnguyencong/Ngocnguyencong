# apps/web/src/kit/blocks/app/stat-grid.module.css

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Styles for the stat-grid app block: responsive card grid plus the `.delta`
trend chip — `[data-tone="good"]` → `--success`, `"bad"` → `--danger`,
`"flat"` → `--muted`; small pill radius, icon+text inline-flex.

## Important Notes / NEVER Change

- Token colors only; chip must remain legible at compact density.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Added `.delta` chip tones for WP4 | Devin |
| 2026-10-16 | Grid min track 200px → 9.5rem so 6 KPIs fit one row at 1440 (no orphan) | Devin |
