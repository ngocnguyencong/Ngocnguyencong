# Prompt: new landing page

Build a landing page for **`<product>`** at `<route>` whose only conversion
goal is `<cta>`.

Product one-liner: `<what it does and for whom>`

Use the kit's marketing surface + block library, not a bespoke design system:

1. Compose the page from blocks in `apps/web/src/kit/blocks/marketing/` —
   `hero-centered`, `feature-grid`, `pricing-cards`, `cta-band` — copying each
   `.tsx` + `.module.css` only where product-specific behavior is needed.
   For the restrained light "minimal" look (`minimal` pack /
   `minimal-product` style), compose in this order:
   `hero-product` → `steps-ruled` → `feature-story` → `comparison-ruled` →
   `pricing-panel` → `faq-split` → `cta-form`, with `product-frame` wherever
   product UI should float above the ruled page. Preview the whole set on
   the dev-only `/kit-blocks` route first — it shows both the composed
   minimal landing and each block.
2. Wrap the page in a `.marketing-theme` root so it follows
   `MARKETING_THEME_MODE` in `apps/web/src/theme/marketing-theme.ts` — check
   the current mode and say which marketing identity the page will get.
3. Every value must come from tokens (`var(--page|--raised|--text|--muted|
--border|--accent|--radius-*|--font-*|--space-*)`) — no hardcoded colors,
   so the page restyles with any pack and the marketing mode works.
4. Icons from `lucide-react` only (`aria-hidden` on decorative ones).
5. One obvious CTA (`<cta>`), minimal copy, no fake screenshots or dead links.
   Semantic HTML, real labels, visible focus, reduced-motion support, works at
   360px and without JS except for genuinely interactive islands.
6. Verify: `pnpm check` green + desktop and mobile screenshots of the page
   under at least two different theme packs.

If a needed section has no block, build it in the same token-only style and
offer to register it in `apps/web/src/kit/blocks.ts` instead of one-off CSS.
