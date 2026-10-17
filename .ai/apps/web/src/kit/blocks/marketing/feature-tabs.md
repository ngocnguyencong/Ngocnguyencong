# apps/web/src/kit/blocks/marketing/feature-tabs.tsx

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Copyable marketing block — interactive "feature tour" tabs. A tab strip of
capability names reveals one panel at a time: headline, description, bullet
points, and a product visual slot.

## What It Does

- `FeatureTabs({ heading, sub, label, items, defaultActiveId })` renders a
  section with an optional header (same `heading`/`sub` grammar as
  feature-grid) plus a left tab rail (top horizontal strip under 860px).
- `FeatureTabItem`: `{ id, label, title, description, points, icon?, media? }`.
  `icon` accepts a `LucideIcon` component or a `ReactElement` (narrower
  than `ReactNode` so non-element nodes cannot reach `createElement`) —
  server callers must pass an element (`<ShieldCheck />`) because
  component references cannot cross the RSC boundary into this client
  block. `media` defaults to
  a `ProductFrame` placeholder surface, so the registry entry also ships
  `product-frame`'s files (same dependency pattern as `hero-product`).
- WAI-ARIA tabs: `role="tablist"` (`aria-label` from `label`/`heading`/
  "Features"), `role="tab"` buttons with `aria-selected`, `aria-controls`,
  roving `tabIndex` (selected tab keeps the only tab stop), `role="tabpanel"`
  with `aria-labelledby` and `tabIndex={0}`. Arrow keys (all four — the rail
  is vertical on desktop, horizontal on narrow screens), Home, and End move
  focus and activate automatically; Enter/Space activate via the native
  button click. `defaultActiveId` picks the initially selected tab.
- Fails open: every panel stays in the DOM; the hiding rule for inactive
  panels requires `(scripting: enabled)`, so no-JS readers get all copy
  (scroll-reveal's contract). The 180ms panel entrance animation requires
  `prefers-reduced-motion: no-preference`; reduced-motion visitors get an
  instant swap.
- Empty `items` renders nothing. Item `id` must be a unique slug — it seeds
  the generated tab/panel aria ids.
- Stale-selection safety: if `items` changes to a set lacking the stored
  `activeId`, rendering falls back to `items[0]` so the widget always has
  exactly one selected tab/panel pair (the next interaction stores a valid
  id again).

## Open Threads / Resume Context

None.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Initial block — client component, fail-open tab panels, ProductFrame default media | Devin |
| 2026-10-10 | Review fixes — stale-`activeId` fallback to `items[0]`; `icon` narrowed to `LucideIcon \| ReactElement` | Devin |
