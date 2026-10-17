# kit/blocks/marketing — minimal set

> Last updated: 2026-09-24 | Protection: STANDARD

## Purpose

Eight token-only marketing blocks implementing the approved "minimal"
grammar (an approved mockup → `minimal` pack / `minimal-product` style):
white paper, structure from `--border` hairlines and joined panels, pill
actions, and exactly one elevated surface (the product frame: radius 14,
`--border-strong`, `0 1px 2px rgba(0,0,0,.04), 0 24px 48px -24px
rgba(0,0,0,.18)`).

## Files

- `product-frame.tsx` — elevated window chrome (3 dots + centred URL pill
  on `--section`, hairline under chrome). Reused by `hero-product`.
- `hero-product.tsx` — left-aligned hero (eyebrow → h1 clamp(3rem,6.2vw,
  4.25rem)/520/−.035em → 20px lede → pill + text link) then a full-width
  `ProductFrame`. CSS-only load entrance (staggered 60ms, 8px rise, frame
  +240ms/16px) under `prefers-reduced-motion: no-preference`; faint
  `color-mix(--border-strong 45%)` radial wash at top.
- `steps-ruled.tsx` — client; N steps in one row of vertical hairlines.
  IntersectionObserver flips `data-reveal` once: 1px `--accent` line
  scaleX across the top over 900ms while each step's icon/title resolve
  `--muted`→final at `--step-d` (i·900/N). ≤720px: vertical list, line on
  the left via scaleY.
- `feature-story.tsx` — client; alternating copy/vignette rows separated
  by hairlines; per-row IO, media rises 12px, copy +80ms. `mediaLabel` +
  `mediaMeta` render the frame header ("To approve / 3 pending" pattern).
  ≤900px stacks, vignette below copy.
- `comparison-ruled.tsx` — real `<table>` + `th scope`, hairlines only;
  `us` column `--text` 550 + lucide `Check` in `--accent`, `them` muted.
  ≤640px stacks into definition rows (labels from `data-col` attr).
- `pricing-panel.tsx` — joined panel (`--border-strong`, radius 12,
  hairline columns); recommended = `color-mix(--accent 4%)` tint + accent
  label + primary pill (others outline); price 32px/520/tabular-nums;
  CTA bottom-aligned. ≤900px stacks.
- `faq-split.tsx` — intro 5fr / details list 7fr; native `<details>`
  (`suppressHydrationWarning` like resource-pages), chevron rotates
  160ms, answer opens via `grid-template-rows: 0fr→1fr` +
  `interpolate-size: allow-keywords` progressive enhancement. Works no-JS.
- `cta-form.tsx` — centred closing section; `children` is the product's
  own form; `CtaForm.Input`/`Button`/`Link` compound components keep the
  44px pill grammar.

## Important Notes

- All motion fails open: pending/hidden states only exist under
  `(scripting: enabled)` + `(prefers-reduced-motion: no-preference)` —
  SSR, no-JS, and reduced-motion see the final state. `blocks.test.ts`
  contract-pins this for steps-ruled/feature-story.
- Pills are duplicated per module.css (blocks must be self-contained
  pairs; hero-product's `files` entry also lists product-frame because it
  imports it).
- Body copy uses `--content-text` (not `--muted`) per the pack spec;
  `--btn`/`--btn-text` fill primary pills — do not substitute `--accent`.
- Icons: caller slots are `ReactNode`; only internal glyphs (Check,
  ChevronDown) import lucide-react — intentional deviation, see blocks.md.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-24 | Initial set (8 blocks) | Devin |
