# apps/web/src/kit/blocks/marketing/hero-split.module.css

Theme-aware surface styles for this repository.

Authored load entrance (2026-10-09): `.copy > *` plays `heroIn` (480ms,
60ms nth-child steps) and `.media` plays `frameIn` (16px rise, 240ms
delay) — CSS-only under `prefers-reduced-motion: no-preference`, matching
hero-product's grammar. Resting state is the final state.

2026-10-06: Colored foregrounds use `--accent-text` with an accent fallback. Keep action fills, borders, and control indicators on `--accent`; light-palette text must meet 4.5:1 on plain and tinted surfaces.
