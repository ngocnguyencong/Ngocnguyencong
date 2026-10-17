# apps/web/src/kit/blocks/app/metric-trend.tsx + metric-trend.module.css

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`MetricTrend` kit block — a KPI stat card for dashboard tops: muted label,
big formatted `value`, a pill `delta` chip (`TrendingUp`/`TrendingDown`/
`Minus` lucide glyphs + caller's `text`), and a tiny inline 96×32
sparkline svg. Server component; registered in `KIT_BLOCKS`, surface
`app`; demoed at `/kit-blocks` as a 4-card auto-fit row.

## Public API

```ts
MetricTrend({ label, value, delta, points } : {
  label: string;
  value: string;   // pre-formatted ("1,248", "$4.2k")
  delta: {
    direction: "up" | "down" | "flat";
    text: string;
    tone?: "positive" | "negative" | "neutral" | undefined;  // defaults from direction
  };
  points: readonly number[];
})
```

## What It Does

- `.card` = `.top` (label + delta chip) + `.main` (value + sparkline).
- `data-tone` on the chip comes from `delta.tone` — defaulting to direction
  (`up`→`"positive"`, `down`→`"negative"`, `flat`→`"neutral"`) so callers
  can decouple tone from icon for metrics that improve when they fall
  (latency, churn): `{ direction: "down", tone: "positive" }`. Positive
  styles `var(--telemetry, var(--accent))`/`var(--telemetry-soft, …)`
  (globals.css tokens, not catalog — fallbacks keep the chip readable if a
  product rebuilds tokens), negative `var(--danger, var(--muted))` (kit
  defines no `--danger`; products that add one get it free), neutral
  `var(--muted)` on a `color-mix` muted tint.
- `direction: "flat"` renders the `Minus` glyph (no trend arrow) — for
  unchanged metrics (e.g. flat churn); pair with a level `points` series,
  which draws the sparkline mid-height via the `range === 0` guard.
- Sparkline reuses the same min→max range scaling as chart-line (trend shape,
  not magnitude; flat series draws mid-height); `<2` points hides the svg.
  It carries `role="img"` + `aria-label` (`"<label> sparkline: <n> points,
  last <v>"`) — no hidden table here because label/value/delta are already
  real text.
- `TrendingUp`/`TrendingDown`/`Minus` import `lucide-react` directly —
  structural glyphs, the same sanctioned deviation as the minimal set's
  Check/ChevronDown and paywall-gate's Lock.

## Important Notes / NEVER Change

- Tokens only (`--raised`/`--border`/`--muted`/`--text`/`--telemetry*`
  /`--accent`); `--danger` is referenced ONLY behind a `var(--danger,
  var(--muted))` fallback — never a bare `--danger` (undefined in the kit).
- `data-tone` values are `"positive"`/`"negative"`/`"neutral"`, not the raw
  direction — `direction` picks the icon, `tone` picks the chip styling
  (resolved 2026-09-27 via `delta.tone`; the kit-blocks Latency demo
  exercises the decoupled case, Churn rate the flat default).
- `blocks.test.ts` greps this pair for `role="img"`, `aria-label`, and the
  no-literal-colors contract — keep all present.

## Bug Fixes

None yet.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | `direction` += `"flat"` (`Minus` icon, default tone `"neutral"` — muted chip) and `tone` union += `"neutral"`; kit-blocks demo gained a 4th flat card | Devin |
| 2026-09-27 | `delta.tone` prop added — decouples chip tone from direction (falling-is-good metrics like latency); `--telemetry(-soft)` gained `var(--accent)`-derived fallbacks | Devin |
| 2026-09-27 | Created — KPI card + delta chip + inline sparkline (Task 4 data-viz blocks) | Devin |
