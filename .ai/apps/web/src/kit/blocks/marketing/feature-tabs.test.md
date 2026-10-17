# apps/web/src/kit/blocks/marketing/feature-tabs.test.tsx

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Contract tests for the `feature-tabs` kit block: SSR markup via
`renderToStaticMarkup` (same convention as `testimonial-grid.test.tsx`)
plus mounted jsdom interaction tests (`createRoot` + `act`, same harness
as `pagination.test.tsx` — the file runs under
`// @vitest-environment jsdom` and cleans up in `afterEach`).

## Coverage

- Fail-open: every `role="tabpanel"` renders in the static markup (all copy
  readable without JS), exactly one active tab+panel pair on first render,
  and no `hidden` attribute anywhere.
- WAI-ARIA wiring: `role="tablist"`, `role="tab"` count,
  `aria-selected` true/false, `aria-controls`/`aria-labelledby` references
  resolving to real ids, roving `tabindex` (one tab stop + focusable panels).
- `defaultActiveId` selects the matching item's tab and panel; missing
  `media` renders the `ProductFrame` placeholder (`mediaPlaceholder` class).
- Keyboard behavior (jsdom): ArrowRight/ArrowLeft move selection and focus
  together (automatic activation), wrapping at both ends; Home/End jump to
  the first/last tab. Asserts `aria-selected`, roving `tabIndex`,
  `document.activeElement`, and panel `data-active`.
- Stale-selection recovery (jsdom): re-rendering with an `items` set that
  lacks the selected id falls back to the first item — a selected
  tab+panel pair is always present.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Initial test | Devin |
| 2026-10-10 | Added jsdom keyboard-navigation + stale-items recovery tests | Devin |
