# apps/web/src/kit/blocks.test.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Registry + safety contracts for `kit/blocks.ts` (`KIT_BLOCKS`).

## Coverage

- Core marketing/chrome blocks are registered (hero, FAQ, changelog
  timeline, newsletter, header/footer, prose page…).
- `ambient-background` stays decorative-only + reduced-motion safe.
- Minimal marketing set registered (product-frame, hero-product,
  steps-ruled, feature-story, comparison-ruled, pricing-panel, faq-split,
  cta-form).
- Minimal scroll-driven blocks fail open like scroll-reveal:
  IntersectionObserver, `prefers-reduced-motion: no-preference`,
  `scripting: enabled` gates.
- `scroll-reveal` hidden only with scripting + full motion.
- `feature-tabs` ships a fail-open WAI-ARIA tabs widget: `"use client"`,
  `role="tablist"`/`"tab"`/`"tabpanel"`, `aria-selected`/`aria-controls`/
  `aria-labelledby`/roving `tabIndex`, ArrowRight + Home + End keys,
  `scripting: enabled` gate for hiding inactive panels,
  `prefers-reduced-motion: no-preference` entrance, token-only css (no
  hex or rgb()/hsl() literals).
- Data-viz blocks (`chart-line` marketing; `data-viz-bars`,
  `data-viz-donut`, `metric-trend` app): registered with on-disk files;
  each `.tsx` exposes `role="img"` + `aria-label`; css files carry no
  hex/rgb()/hsl() literals; chart-line/bars/donut ship a visually-hidden
  `<table>` fallback (grep: `<table`, `clip`, `1px`).
- Data-viz math pins: bars zero-baseline clamp (`Math.max(0`), donut
  `data-swatch` on both arc circles and legend swatches + matching
  `.arc[data-swatch`/`.swatch[data-swatch` css selectors, flat-series
  `range === 0` NaN guard in chart-line + metric-trend.
- metric-trend flat contract: `"flat"` in the direction union, `"neutral"`
  in the tone union, `[data-tone="neutral"]` styling in the css.
- Master/detail, table-toolbar, and pagination are registered with matching
  token-only `.tsx`/`.module.css` files; focused jsdom tests cover controlled
  selection/search/page callbacks, mobile focus return, disabled actions, and
  empty/loading/error states.
- Resolve each source/CSS file by extension, rejecting missing paths before reading.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | +feature-tabs contract: client component, tabs roles/attrs/keys, scripting-gated hiding, reduced-motion entrance, token-only css; added to the public-site vocabulary list | Devin |
| 2026-10-06 | +controlled app record blocks, file registration, and behavior contract coverage | Codex |
| 2026-09-27 | +metric-trend flat-direction contract (`"flat"` direction, `"neutral"` tone, `[data-tone="neutral"]` css) | Devin |
| 2026-09-27 | +data-viz math pins: bars zero-baseline clamp, donut arc↔legend data-swatch pairing, flat-series range===0 guards | Devin |
| 2026-09-27 | +data-viz contracts: surface registration, role="img"/aria-label, token-only css, hidden-table fallback for chart-line/bars/donut | Devin |
| 2026-09-27 | Minimal-set cases merged via feat/prod-ready-kit — initial mirror | Devin |
