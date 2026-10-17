# apps/web/src/supadata/web/trend-chart.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Inline SVG trend chart for the KPI timeseries — token colors, no chart dependency.

## Important Notes / NEVER Change

- None.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
| 2026-10-16 | Metric toggles: arrow/Home/End keyboard nav + focus mgmt; visually-hidden data table summarizes all series | Devin |
| 2026-10-16 | Axis labels + hover dot moved to HTML overlays; svg stretches via preserveAspectRatio="none" + non-scaling-stroke; ≤520px hides alternate x ticks (~4 shown) | Devin |
