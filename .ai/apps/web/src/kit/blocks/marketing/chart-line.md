# apps/web/src/kit/blocks/marketing/chart-line.tsx + chart-line.module.css

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`ChartLine` kit block — a dependency-free SVG line chart for marketing stats
(signup sparklines, traffic trends). Points map to a `320×160` viewBox in pure
TS; the render is a baseline hairline + polyline + per-point dots. Server
component (no `"use client"`), no animation — static by design, fails open.
Registered in `KIT_BLOCKS`, surface `marketing`; demoed at `/kit-blocks`.

## Public API

```ts
type LinePoint = { label: string; value: number };
ChartLine({ label, points, tone } : {
  label: string;
  points: readonly LinePoint[];
  tone?: "primary" | "muted" | undefined;  // default "primary"
})
```

## What It Does

- `<figure>` = caption text + `<svg role="img">` + visually-hidden `<table>`.
- `toCoords` scales the y-axis to the data range (min→bottom, max→top) —
  deliberately NOT zero-based; the chart shows trend shape, not magnitude.
  Flat series draw mid-height; a single point renders a centered dot, no
  polyline; an empty series renders a "No data yet." note.
- `aria-label` summarizes the trend (`"<label>: <n> points, rising|falling|
  flat, last value <v>"`); the hidden table lists every point as
  `<th scope="row">label</th><td>value</td>` — the real per-point text.
- `tone="muted"` re-strokes the line/dots to `--muted` via
  `.chart[data-tone="muted"]` selectors.

## Important Notes / NEVER Change

- Tokens only (`--accent`/`--muted`/`--border`/`--text`); no hex/rgb/hsl —
  the pair must copy into a product unchanged.
- `.svg` keeps `overflow: visible` so edge dots/round linecaps never clip.
- `.table` is the sr-only recipe (`position:absolute`, 1px box,
  `clip: rect(0 0 0 0)` + `clip-path: inset(50%)`) — it is the accessible
  data carrier; do not drop it for an aria-label-only shortcut.
- `blocks.test.ts` greps this pair for `role="img"`, `aria-label`, `<table`,
  `clip`/`1px`, and the no-literal-colors contract — keep all present.
- Zero-baseline dishonesty note: line charts scale to data; if a caller needs
  honest magnitude comparison, point them at `data-viz-bars`.

## Bug Fixes

- 2026-09-27: hidden-table row keys were `point.label` — duplicate labels
  collided; now `${label}-${index}` like the dot keys.
- 2026-09-27: aria-label rendered "1 points" for a single-point series —
  now singularizes to "1 point".

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Fixed table row keys (duplicate-label collision) + singular "1 point" in the aria-label | Devin |
| 2026-09-27 | Created — dependency-free SVG line chart for marketing stats (Task 4 data-viz blocks) | Devin |
