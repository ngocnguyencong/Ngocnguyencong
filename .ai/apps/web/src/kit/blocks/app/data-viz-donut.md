# apps/web/src/kit/blocks/app/data-viz-donut.tsx + data-viz-donut.module.css

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`DataVizDonut` kit block — a dependency-free donut chart for part-to-whole
shares (plan mix, channel split, spend breakdown). One stroked `<circle>` per
slice drawn with `stroke-dasharray`/`stroke-dashoffset` inside a
`rotate(-90 …)` group so slices start at 12 o'clock and run clockwise.
Server component; registered in `KIT_BLOCKS`, surface `app`; demoed at
`/kit-blocks`.

## Public API

```ts
type DonutSlice = { label: string; value: number };
DataVizDonut({ label, slices } : {
  label: string;
  slices: readonly DonutSlice[];
})
```

## What It Does

- `<figure>` = caption + `.body` (donut svg with center total overlay + legend
  `<ul>`) + visually-hidden `<table>` of label/value rows.
- Segment math: `dash = value/total × C − GAP` (GAP=2 viewBox units between
  arcs), `dashoffset` accumulates prior lengths; a faint `.track` ring sits
  beneath so the gaps read as separators.
- Six-slot palette via `data-swatch="0..5"` sets `--slice-color` on both
  `.arc` (stroke) and `.swatch` (legend dot) — `--accent`, `--muted`, plus
  accent/telemetry↔muted mixes; `--telemetry` reads through
  `var(--telemetry, var(--accent))` since it lives in globals.css, not
  `THEME_TOKEN_NAMES`. Designed for 3–6 slices; beyond six the palette
  cycles — aggregate tails into "Other" upstream.
- `aria-label` = `"<label>: <n> slices, total <sum>"`; center overlay shows
  the sum (`aria-hidden`, redundant with label + table). Both render the
  `round()`ed total so float noise never shows.
- Zero-sum (or empty) `slices` renders a "No data yet." note — never a blank
  ring or NaN dasharray. The hidden `<table>` renders in BOTH branches (it
  is hoisted into a shared `table` const) so slice data stays readable even
  when it cannot be drawn.
- Negative slice values clamp to 0 for every rendered surface (`values[]`
  normalization feeds total/segments/legend) — donuts can't draw negative
  arcs; the hidden table keeps the raw caller value.
- The legend `<ul>` carries `role="list"` — Safari/VoiceOver drops list
  semantics on `list-style: none` without it.

## Important Notes / NEVER Change

- Tokens only; palette slots are `var(--*)`/`color-mix` on tokens — no
  hex/rgb/hsl literals anywhere in the css.
- Legend `<li>` order must stay 1:1 with slice order so swatch colors match
  the arcs (both keyed off `index % PALETTE_SIZE`).
- The hidden `.table` is the accessible data carrier — keep it even though a
  legend exists (legend shows rounded `value · pct%`, table keeps raw values).
- `blocks.test.ts` greps this pair for `role="img"`, `aria-label`, `<table`,
  `clip`/`1px`, and the no-literal-colors contract — keep all present.

## Bug Fixes

- 2026-09-27: negative slice values drew invisible arcs but showed
  `-10 · -25%` legend rows — now clamped to 0 across total/segments/legend
  (raw value kept in the hidden table).
- 2026-09-27: legend `<ul>` regained `role="list"` (Safari/VoiceOver drops
  list semantics under `list-style: none`).
- 2026-09-27: center total + aria-label total now `round()`ed — float sums
  like `0.30000000000000004` no longer render raw.
- 2026-09-27: zero-sum early return now renders the hidden `<table>` too
  (shared `table` const) — matching line/bars, which always ship theirs.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Clamp negative slices; `role="list"` on legend; rounded totals; hidden table renders in the zero-sum branch; `--telemetry` fallback | Devin |
| 2026-09-27 | Created — dasharray donut + token palette + center total (Task 4 data-viz blocks) | Devin |
