# apps/web/src/supadata/web/live-view.module.css

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Styles for the live visitors view (`live-view.tsx`): realtime list rows,
truncate long paths/referrers, and mobile-safe wrapping so the 390px layout
does not overflow. Token colors only.

## Important Notes / NEVER Change

- Keep truncation via `min-width: 0` + `text-overflow: ellipsis` rather than
  fixed pixel widths.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Mobile truncation/overflow fixes for WP4 | Devin |
