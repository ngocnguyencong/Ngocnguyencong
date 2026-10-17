# prompts/new-landing-page.md

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Pasteable prompt that builds a landing page for `<product>` at `<route>`
with a single conversion goal `<cta>` — composing the marketing block
library, not a bespoke design system.

## What It Does

- Composes from `apps/web/src/kit/blocks/marketing/` (`hero-centered`,
  `feature-grid`, `pricing-cards`, `cta-band`), copying `.tsx` +
  `.module.css` only where product-specific behavior is needed.
- Prescribes the minimal-set order for the `minimal` pack /
  `minimal-product` look: `hero-product` → `steps-ruled` →
  `feature-story` → `comparison-ruled` → `pricing-panel` → `faq-split` →
  `cta-form`, with `product-frame` where product UI floats above the ruled
  page; previews the set on the dev-only `/kit-blocks` route first.
- Wraps the page in `.marketing-theme` so it follows
  `MARKETING_THEME_MODE` in `apps/web/src/theme/marketing-theme.ts` — the
  agent must state which marketing identity the page gets.
- Tokens only, `lucide-react` icons (`aria-hidden` on decorative), one
  obvious CTA, semantic HTML, real labels, visible focus, reduced-motion
  support, works at 360px and without JS except genuine islands.
- Verification: `pnpm check` green + desktop and mobile screenshots under
  at least two theme packs; a missing section becomes a new registered
  block, not one-off CSS.

## Important Notes / NEVER Change

- "No fake screenshots or dead links" is part of the neutral demo-content
  boundary — keep it in the prompt.
- Token-only + registered-blocks constraints are the same standing rules
  `prompts/README.md` lists; keep wording aligned when they evolve.

## Change History

| Date       | Change             | Author |
| ---------- | ------------------ | ------ |
| 2026-10-06 | Initial mirror doc | Devin  |
