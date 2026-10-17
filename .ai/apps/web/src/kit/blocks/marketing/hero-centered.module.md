# src/kit/blocks/marketing/hero-centered.module.css

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Token-based centered hero layout and actions.

## What It Does

Styles the optional trust link and overlapping avatar row with theme tokens and wrap behavior on narrow screens. Link is standard HTML and works without JavaScript.

The optional subtitle is a separate, smaller serif/italic line using the existing accent token. The title follows its hero container width instead of inheriting the global app h1 measure, so concise headlines can stay on one desktop line and reflow on mobile.

Authored load entrance (2026-10-09): `.inner > *` children play `heroIn`
(480ms, 0.2/0.7/0.2/1, `both` fill) under `prefers-reduced-motion:
no-preference` with 60ms nth-child steps — the same CSS-only grammar as
hero-product. No-JS still animates (it is CSS); resting state is final.

## Open Threads / Resume Context

None.

2026-10-06: Colored foregrounds use `--accent-text` with an accent fallback. Keep action fills, borders, and control indicators on `--accent`; light-palette text must meet 4.5:1 on plain and tinted surfaces.
