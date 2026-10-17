# apps/web/src/kit/blocks/app/skeleton.tsx + skeleton.module.css

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`Skeleton` kit block — a single `aria-hidden` `span` shimmer bar for
loading placeholders (`width`/`height`/`radius`/`className` props;
registered in `KIT_BLOCKS`, surface `app`).

## Important Notes / NEVER Change

- Token-only: base is `color-mix(in srgb, var(--text) 8%, transparent)` so
  it reads on both `--raised` and `--page` surfaces — do NOT revert to a
  flat `var(--raised)` base (invisible on raised cards, fixed 2026-09-23).
- Shimmer is a 1.6s linear sweep of a 14% text-tinted band via `::after`;
  `prefers-reduced-motion: reduce` removes the pseudo-element entirely so
  the bar is a static base.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Contrast fix: text-mix base + 14% shimmer (was invisible on `--raised` cards) | Devin |
