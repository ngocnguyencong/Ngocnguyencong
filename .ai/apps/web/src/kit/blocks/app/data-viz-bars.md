# apps/web/src/kit/blocks/app/data-viz-bars.tsx + data-viz-bars.module.css

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`DataVizBars` kit block — a dependency-free vertical bar chart for period
comparisons (weekly signups, monthly revenue). Bars are real flex columns
sized by percentage height — no SVG geometry, no chart library. Server
component; registered in `KIT_BLOCKS`, surface `app`; demoed at `/kit-blocks`.

## Public API

```ts
type BarDatum = { label: string; value: number };
DataVizBars({ label, bars } : {
  label: string;
  bars: readonly BarDatum[];
})
```

## What It Does

- `<figure>` = caption + `.plot` (flex row of `.col`: value, bar lane, x
  label) + visually-hidden `<table>` of label/value rows.
- Bar height = `value / max × 100%` against a fixed 160px plot —
  zero-baseline is mandatory because bar length IS the encoded value
  (unlike chart-line's data-scaled axis). Negative values clamp to 0.
- The whole `.plot` carries `role="img"` + `aria-label` (`"<label>: <n>
  bars, max <max>"`); the visible labels/values inside become presentational
  and the hidden table carries the accessible copy — no double-announce.
- Empty or all-zero `bars` renders a "No data yet." note.

## Important Notes / NEVER Change

- Tokens only (`--accent` bars, `--border` baseline, `--muted`/`--text`
  labels); no hex/rgb/hsl — the pair must copy into a product unchanged.
- `.barLane` draws the `1px --border` baseline every column shares; bars cap
  at `max-width: 44px` and keep `border-radius` on the top edge only.
- Do NOT remove the zero baseline (e.g. scaling to min) — truncated bar
  charts misrepresent magnitude. For trend shape use `chart-line`.
- `blocks.test.ts` greps this pair for `role="img"`, `aria-label`, `<table`,
  `clip`/`1px`, and the no-literal-colors contract — keep all present.

## Bug Fixes

- 2026-09-27: aria-label `max` rendered raw floats — now `round()`ed.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | `round()` the aria-label max (float noise); `Math.max(0` clamp pinned by blocks.test.ts | Devin |
| 2026-09-27 | Created — zero-baseline vertical bars with value labels (Task 4 data-viz blocks; optional add for set completeness) | Devin |
