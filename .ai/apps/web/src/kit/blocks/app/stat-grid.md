# apps/web/src/kit/blocks/app/stat-grid.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

App block: responsive KPI stat grid (`StatItem[]` → label, value, hint).
`StatItem.delta` (optional) renders a trend chip — lucide
`ArrowUpRight`/`ArrowDownRight`/`Minus`, "+12%" text, tone `good`/`bad`/
`flat` via `data-tone` (muted when `|change| < 0.005` or `null` → "—"),
with visually-hidden "vs previous period" text. `goodWhen: "down"` is for
metrics where a decrease is positive (e.g. bounce rate). Existing callers
without `delta` render unchanged.

## Important Notes / NEVER Change

- Delta is optional — do not break callers that omit it.
- Icon is `aria-hidden`; the sr text carries the comparison context.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Added optional `delta` trend chip for WP4 KPI deltas | Devin |
