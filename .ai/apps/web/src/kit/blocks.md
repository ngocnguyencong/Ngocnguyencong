# src/kit/blocks — block library

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

shadcn-style copyable UI blocks: self-contained `.tsx` + `.module.css` pairs
that consume theme tokens only, so they restyle with every pack, preset, and
layout. Registered in `blocks.ts`; browsed at dev-only `/kit-blocks`;
contract-tested by `blocks.test.ts`.

## Rules for new blocks

- `testimonial-grid` is a reusable section with optional heading/intro/anchor, quote-language support, avatar slots, and ratings. Its dev-only `/kit-blocks` demo uses fictional examples; the default landing has no testimonials, customer avatars, ratings, or trust counts. It draws colors, spacing, radius, and fonts from active tokens. Structural stars import `lucide-react`.

- Tokens only (`var(--*)`), no hex, no kit imports — a block must be copyable
  into a product with zero edits besides props/copy.
- Icon slots are `ReactNode` props; never import a specific icon set inside a
  block (callers pass lucide).
- Semantic HTML + responsive via `auto-fit`/`clamp`; min 44px actions;
  reduced-motion-safe transitions only.
- `scroll-reveal` (`<ScrollReveal>`): once-only entrance for below-fold
  content. Hidden `data-reveal="pending"` styles require
  `(scripting: enabled)` + `(prefers-reduced-motion: no-preference)` — SSR
  renders visible, so no-JS/reduced-motion/old browsers never lose content.
  `as` prop keeps list/landmark semantics (`li`, `article`, `section`);
  `delay` (ms) staggers groups via `--reveal-delay`.
- `scroll-end-cta` (marketing): once-per-session follow-up `<dialog>` that
  opens when the visitor reaches the page bottom (`scrollY + innerHeight >=
  scrollHeight - 8`, requires `scrollY > 0` so viewport-height pages never
  fire) or after `delayMs` of visible time (default 90s, pauses while
  hidden). Same guarded `check()` for both triggers — defers 1s while
  another dialog is open or a form control holds focus; sessionStorage
  `storageKey` prevents repeats. Native dialog handles Escape/backdrop/X
  close, focus trap (Tab cycles `a[href], button:not([disabled])`), body
  scroll lock + restore, and reduced-motion-safe 180ms exit. `preview`
  renders the panel inline for `/kit-blocks`. Structural lucide imports
  (MessageCircle/X/ArrowUpRight) — same deviation as the minimal set.
- `feature-spotlight`: media-left + copy-right product story with a row of
  bare minis (no cards). `ordered` switches minis to `<ol>` for real
  sequences; `reverse` flips sides; copy leads above media on narrow.
- `feature-tabs` (marketing, 2026-10-10): interactive feature tour — a tab
  strip (left rail → horizontal strip on narrow) of `{ id, label, title,
  description, points, icon?, media? }` items, each panel revealing
  headline + points + a product visual. Client component implementing the
  WAI-ARIA tabs pattern (roving tabindex, `aria-selected`/`aria-controls`/
  `aria-labelledby`, all four arrows + Home/End, automatic activation).
  Fails open like scroll-reveal: all panels stay in the DOM and inactive
  panels hide only under `(scripting: enabled)`; the 180ms swap entrance
  uses `--motion-enter` under `no-preference`. `media` defaults to a
  `ProductFrame` placeholder, so the registry entry ships product-frame's
  files too (like `hero-product`). `icon` accepts a `LucideIcon` or a node
  (server callers pass elements — refs can't cross RSC). Dev-only
  `/landing-v2` composes an alternate landing around it; `/kit-blocks`
  carries a neutral three-tab demo.
- `product-grid` (marketing): responsive card grid for catalog
  landing sections; media tile falls back to a token-tinted monogram, so
  images are optional; optional `badge`, `href`, `price`.
- `data-table` (app): semantic `<table>` with caption, column defs
  (`align: "end"` for numerics), `key` + `cells` row model — for
  admin/data-heavy surfaces like `/commerce`.
- **Controlled records set** (app, 2026-10-06): `master-detail` accepts stable
  item keys/titles, caller list/detail slots and empty/loading/error states;
  narrow selection moves focus to its visible Back action and Back restores
  the list item. `table-toolbar` owns only labeled controlled search/count and
  a clear-filters action, with arbitrary filter/action children. `pagination`
  bounds controlled previous/next actions and supports a disabled state. No
  block fetches data or reads/writes URL state. `/kit-blocks` and the appearance
  gallery share a localized interactive preview with neutral records.
- `waitlist-band` (marketing): hero-adjacent join band — email field +
  submit + optional Turnstile slot, `status`/`position`/`shareUrl` props
  render joined/invited confirmation + referral share link; used on the
  kit landing between hero and features.
- `ambient-background` (marketing): absolute-fill animated canvas backdrop
  with five `kind`s (globe/rails/grid/constellation/matrix), pause/play
  control, static frame under reduced motion; labels via props.
- `changelog-timeline` (marketing): `<ol>` release timeline — rail
  (`meta`/`tags`) + body (`badge`/`title`/`kind`/`summary`/`points`/
  `items`/`more`) on a spine with per-entry dots; `upcoming` entries get a
  hollow accent-ring dot so a roadmap can pin first.
- **Minimal set** (marketing, 2026-09-24): `product-frame`, `hero-product`,
  `steps-ruled`, `feature-story`, `comparison-ruled`, `pricing-panel`,
  `faq-split`, `cta-form` — the `minimal` pack / `minimal-product` style
  grammar: white paper, hairline-ruled structure, pill actions (radius 999,
  `--btn` fill, 44px, `→` nudge on hover), 128px rhythm, 1120px container,
  Inter only, weight 520 headings. The product frame is the only elevated
  surface (radius 14, `--border-strong`, soft shadow). Motion: hero load
  entrance is CSS-only (`no-preference` gated keyframes); `steps-ruled` +
  `feature-story` are client components using the scroll-reveal fail-open
  pattern (`data-reveal` pending→shown via IntersectionObserver, hidden
  styles only under `scripting: enabled` + `no-preference`); `faq-split`
  animates `<details>` via 0fr→1fr grid-rows + `interpolate-size`
  progressive enhancement. Deviation from the "no icon imports" rule:
  internal structural glyphs (Check in comparison/pricing, ChevronDown in
  faq-split) import `lucide-react` directly — caller-provided icons still
  arrive as `ReactNode` slots.
- `otp-input` (app): one-time-code field — single hidden `<input>` over
  `length` digit boxes (`data-otp-slot`/`data-otp-separator` hooks),
  paste/SMS-autofill stay native under an append-only caret model
  (`clampCaret` snaps selection to the end — mid-string edits can't
  corrupt a code), `onComplete` auto-submit hook; controlled or
  uncontrolled, `name`/`ref` passthrough, even `length >= 4` gets a mid
  dash. Used by `/auth` otp-verify.
- `paywall-gate` (app): locked-content teaser for entitlement-gated CMS
  entries — optional faded `preview` (mask-image fade, capped height,
  `aria-hidden`, pointer-events off), accent lock chip (structural
  `lucide-react` `Lock` import — same deviation as the minimal set),
  `requiredTier`/`title`/`excerpt` copy, accent-fill upgrade `cta`
  (min 44px). Server component, no client directive.
- **Data-viz set** (2026-09-27): `chart-line` (marketing), `data-viz-bars`,
  `data-viz-donut`, `metric-trend` (app) — dependency-free charts (pure TS
  point→coord mapping + tiny SVG / flex bars; NO chart library). Shared
  contract: `role="img"` + `aria-label` summary on the chart region, a
  visually-hidden `<table>` (sr-only recipe: absolute 1px + clip) carrying
  every datum, token-only css. `chart-line`/`metric-trend` scale y to the
  data range (trend shape); `data-viz-bars` keeps a mandatory zero baseline
  (length encodes value). `data-viz-donut` draws dasharray circle segments
  with a six-slot token palette (`data-swatch`), center total, legend —
  designed for ≤6 slices, negatives clamp to 0, zero-sum → empty-state text
  with the hidden table still rendered. `metric-trend` pairs a delta chip
  (`delta.tone` defaults from direction — override for falling-is-good
  metrics; positive→`var(--telemetry, var(--accent))`, negative→
  `var(--danger, var(--muted))` — kit defines neither `--telemetry` in
  catalog nor `--danger`) with a 96×32 sparkline; its TrendingUp/Down
  lucide imports are structural glyphs (same deviation as the minimal set).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-10 | Added feature-tabs (marketing): WAI-ARIA feature-tour tabs, fail-open panels, ProductFrame default media; /kit-blocks demo + dev-only /landing-v2 alternate landing | Devin |
| 2026-10-09 | Added scroll-end-cta (marketing): once-per-session end-of-page/dwell follow-up dialog; chrome site-footer gained a `controls` slot; hero-centered/hero-split gained the heroIn/frameIn load-entrance grammar from hero-product | Devin |
| 2026-10-06 | `product-grid` registry description + source comment reworded ("shop pages") — merchant-side vocabulary is banned in shipped docs resources; matching keys updated in `blocks.*.json`/`beginners.*.json` | Devin |
| 2026-10-06 | Added master-detail, table-toolbar, and pagination app blocks; shared localized interactive foundation preview | Codex |
| 2026-09-27 | Added the data-viz set: chart-line (marketing), data-viz-bars + data-viz-donut + metric-trend (app) — dependency-free charts, role="img" + hidden data table contract; /kit-blocks demos | Devin |
| 2026-09-27 | Added paywall-gate (app): faded-preview locked-content teaser + upgrade CTA pairing with `content_entry.required_entitlement`; /kit-blocks demo | Devin |
| 2026-09-24 | Added the minimal marketing set (8 blocks): product-frame, hero-product, steps-ruled, feature-story, comparison-ruled, pricing-panel, faq-split, cta-form — approved light grammar landed in the kit | Devin |
| 2026-09-27 | prod-ready-kit merge: registered the minimal marketing set (product-frame, hero-product, steps-ruled, feature-story, comparison-ruled, pricing-panel, faq-split, cta-form) — see marketing/minimal-set.md | Devin |
| 2026-09-23 | Added otp-input (app): single-hidden-input one-time-code field — per-digit boxes, paste/SMS autofill, `onComplete` auto-submit; /kit-blocks demo + /auth otp-verify wiring | Devin |
| 2026-09-23 | Added changelog-timeline (marketing): rail+spine release timeline with `upcoming` roadmap-entry variant; /kit-blocks demo | Devin |
| 2026-09-23 | Added tooltip (app): delayed hover / instant focus-visible bubble, aria-describedby on first focusable descendant (wrapper+tabindex fallback), touch pointers never open, persistent hidden bubble; /kit-blocks demo | Devin |
| 2026-09-23 | Added skeleton (app): shimmer placeholder bar, static under reduced motion; used by the /auth pending card | Devin |
| 2026-09-23 | Added ambient-background (marketing): 5-kind canvas backdrop + /kit-blocks demo | Devin |
| 2026-09-22 | Added waitlist-band (marketing) for the growth module | Devin |
| 2026-09-22 | Added product-grid (marketing) + data-table (app) | Devin |
| 2026-09-19 | Added feature-spotlight + scroll-reveal marketing blocks | Devin |
| 2026-10-16 | stat-grid app block += optional `delta` trend chip (good/bad/flat tones, sr "vs previous period") | Devin |
