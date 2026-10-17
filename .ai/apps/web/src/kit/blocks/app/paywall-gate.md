# apps/web/src/kit/blocks/app/paywall-gate.tsx + paywall-gate.module.css

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`PaywallGate` kit block — a locked-content teaser for entitlement-gated
CMS entries (`content_entry.required_entitlement`): an optional faded
`preview` of the real content melts into a centered panel with an accent
lock chip, optional `title`, `excerpt` + "available to {requiredTier}
subscribers" copy, and an accent-fill upgrade `cta`. Server component (no
`"use client"`); registered in `KIT_BLOCKS`, surface `app`; demoed at
`/kit-blocks`.

## Important Notes / NEVER Change

- Tokens only (`--raised`/`--border`/`--text`/`--muted`/`--accent`/
  `--accent-ink`/`--radius-card`/`--radius-control`/`--button-min-height`);
  no hex literals — the pair must copy into a product unchanged.
- `.preview` fade is `mask-image: linear-gradient(to bottom, black 30%,
  transparent)` (+ `-webkit-` prefix) with `max-height: 200px` +
  `overflow: hidden`, `pointer-events: none`, `user-select: none`, and
  `aria-hidden="true"` + `inert` on the element — the teaser is decorative;
  the panel carries the real message. `inert` (React 19 native boolean
  attribute) keeps caller-supplied teaser markup out of the keyboard
  tab order inside the `aria-hidden` subtree. Keep all guards together.
- `.preview + .panel` draws the hairline divider only when a preview
  exists; `.gate` has `overflow: hidden` so preview edges clip to the
  card radius.
- `.cta` is the kit primary-button recipe (accent fill, `--accent-ink`
  text, `min-height: var(--button-min-height, 44px)`, scale(0.97) on
  `:active`, `--accent-hover` fallback) — same as `empty-state`'s CTA.
- `Lock` is imported from `lucide-react` directly — a structural glyph,
  same sanctioned deviation as the minimal set's Check/ChevronDown.
  Caller-provided icons still arrive as `ReactNode` slots.
- Props are generic (`cta`, `requiredTier`, `excerpt`, `preview`,
  `title`) — nothing references entitlements/billing internals, so a
  copied block works for any product. `excerpt` renders inline before the
  standard gated sentence with a trailing space.
- Preview content must already be safe teaser markup — the block renders
  `preview` verbatim (no sanitization is the caller's responsibility).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | `inert` added to the preview wrapper (teaser markup can never take keyboard focus inside `aria-hidden`); `title` gained JSDoc; `excerpt` doc corrected — it renders inside the panel, merged into the gated sentence | Devin |
| 2026-09-27 | Created — locked-content teaser pairing with `content_entry.required_entitlement` (Task 2 of the entitlement-gating plan) | Devin |
