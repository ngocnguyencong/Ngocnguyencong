# apps/web/src/kit/blocks/marketing/feature-tabs.module.css

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Theme-aware presentation for the feature-tabs block — token consumers only
(`var(--*)`), no hex or rgb()/hsl() literals.

## Important Notes

- Layout: `minmax(180px, 260px)` tab rail + flexible panel column, stacking
  to a scrollable horizontal tab strip (hairline bottom border, hidden
  scrollbar) under 860px. The active tab carries a 2px `--accent` tick that
  sits on the rail/border line.
- Fail-open contract: `.panel:not([data-active="true"])` hides ONLY inside
  `@media (scripting: enabled)` — without scripting every panel shows, so
  readers always get the full text (same philosophy as scroll-reveal).
- Motion: `.panel[data-active="true"]` replays `featureTabPanelIn`
  (`--motion-enter`, 180ms, `--ease`) whenever a tab activates — gated on
  `(prefers-reduced-motion: no-preference)`. Hover/focus feedback
  transitions use `--motion-feedback` and drop to `none` under reduce.
- Tab targets keep `min-height: var(--button-min-height, 44px)`;
  `:focus-visible` uses the 2px `--accent` outline shared by sibling blocks.
  Under the ≤860px scroll strip the outline switches to
  `outline-offset: -2px` so the scrollport's `overflow-x: auto` clipping
  cannot cut the focus ring.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Initial stylesheet — rail/strip tab chrome, fail-open panel hiding, enter-token swap animation | Devin |
| 2026-10-10 | Narrow-mode `outline-offset: -2px` so scrollport clipping can't cut the focus ring | Devin |
