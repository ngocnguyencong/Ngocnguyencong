# apps/web/src/marketing/marketing.module.css

> Last updated: 2026-10-04 | Protection: STANDARD

## Purpose

The marketing surface's single stylesheet — `.home` wrapper resets, fixed
site header, hero, section blocks, buttons, footer, and the motion gates
(`data-ready`/`data-replay`/`data-paused`, `prefers-reduced-motion`).
Marketing inherits the selected style by default; explicit Obsidian locking remains available. Demo brand links contain text only.

## Important Notes

- **Element margin reset is zero-specificity** (2026-09-26): the
  `h1–h3`/`p`/`ul`/`ol`/`figure` reset lives inside `:where(.home)` so it
  only beats the UA stylesheet. At plain `.home h1` (0,1,1) it tied
  `.intro h1`/`.intro p` and beat `.status`/`.prose` — stylesheet order
  then decided whether `margin: auto` survived, which intermittently
  pinned utility-page titles and lists to the left edge (showcase,
  contact, legal). `utility-page.contract.test.ts` guards it.
- **Header is always frosted** (2026-09-24): `.header` carries
  `color-mix(--page 55%)` + `blur(14px)` + transparent `border-bottom` at
  every scroll position — no JS needed for legibility over media.
  `.headerScrolled` (scrollY>20, toggled by site-header) only deepens it:
  `--page 78%`, `blur(16px)`, `border-bottom-color: var(--border)`. The
  `@supports not (backdrop-filter)` fallback targets `.header` (opaque
  `--section` at ALL positions — same specificity as `.headerScrolled`,
  later in source so it wins).
- **Buttons have no hover underline** (2026-10-04): remove the CTA `::after`
  underline and the mobile-menu positioning override. Shared `.btn:hover`
  retains its press feedback (`translateY(1px)`), and `:active` retains its
  deeper press. `.btnPrimary:hover` retains the accent shadow;
  `.btnSecondary:hover` retains its background/border feedback. Keyboard
  focus still uses the shared visible outline.
- `.btn > span` (`.btnArrow`) keeps its `translateX(3px)` nudge on
  `.btnPrimary:hover`.
- Entrance/motion plumbing: `.home:not([data-ready="true"]) *` and
  `[data-replay]` kill animations; `prefers-reduced-motion: reduce` kills
  `.btn`/`moduleCard`/`faqIcon` transitions + all `::before/::after`
  animations. CTA underlines remain absent under reduced motion.
- `.btn:hover` dip is `(hover:hover)`-gated so sticky touch hover can't
  leave a button pressed.

## Verification

- Browser checks at 1440px (normal and reduced motion) and the 390px mobile
  menu confirm no hover underline and a visible 2px keyboard focus outline.
- CSS formatting and scoped diff checks pass. This refinement stays local.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Desktop nav links drop the `::after` hover underline — hover/focus-visible now changes color only; base `transition` narrowed to `color`, `.home` override and reduced-motion selector list updated | Devin |
| 2026-10-09 | `.footerBar` — full-width (grid-column 1/-1) end-aligned controls row above ConsentBanner: top hairline, wrap, 10px gap; hosts ThemeMenu/LanguageSwitcher | Devin |
| 2026-10-04 | Remove shared CTA hover underlines and unused mobile-menu underline positioning | Codex |
| 2026-09-26 | Element margin reset moved inside `:where(.home)` — fixes cascade-order-dependent left-pinned titles/status/prose on utility pages | Devin |
| 2026-09-24 | Always-frosted header (frost moved from `.headerScrolled` to `.header`; `@supports` fallback now opaque at all positions) + key-press buttons (accent underline `scaleX` + press-down hover/active replace the sheen sweep; stray `display:none` `::after` blocks removed) | Devin |

## User motion refinement (2026-10-06)
Smooth hover/press/focus feedback with named properties and shared easing; keep interactions interruptible, touch hover gated, and reduced motion usable. Static content does not receive arbitrary movement.

2026-10-06: Colored foregrounds use `--accent-text` with an accent fallback. Keep action fills, borders, and control indicators on `--accent`; light-palette text must meet 4.5:1 on plain and tinted surfaces.

2026-10-12 navigation repair plan: Center desktop navigation items vertically, use text color for hover/focus/current state, preserve existing local visual refinements and keyboard focus outlines.

2026-10-12 complete: desktop nav align-items:center; hover/focus/current-page text colors share the existing text token. Existing local removal of hover pseudo-underlines preserved. No product content changes. Two focused browser regressions pass at 1440px and 320px/reduced motion, including Docs-to-Blog text link navigation; two utility CSS contract tests and scoped ESLint/Prettier pass. Screenshots tmp/navigation-kit-{desktop,mobile}.png. Changes remain local alongside pre-existing work.
