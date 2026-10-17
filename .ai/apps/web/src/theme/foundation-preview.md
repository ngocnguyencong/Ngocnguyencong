# FoundationPreview

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Interactive localized preview of the copyable app foundation blocks and the
shared UI primitives.

## Public API

- `FoundationPreview({ locale?: AppLocale })`; English is the default.
- Localized copy for en/de/es/fr lives in `preview-copy.ts`.
- Controlled local sample state exercises search, status filters, pagination,
  master/detail selection, loading/empty/error/disabled states, and overlays.

## Important Notes

- Sample records are generic and fictional. Search/filter/page state is local;
  this preview performs no network requests and does not use URL state.
- Reuse shared Select, Popover, Dialog, Sheet, Tabs, and Disclosure primitives.
- The same preview is mounted in Settings → Appearance and `/kit-blocks`.

## Validation

- Shared `FoundationPreview` is mounted by the root Appearance gallery and the
  dev-only `/kit-blocks` page. Its demo uses fictional generic records, local
  filtering/paging, and no network or URL state.

2026-10-06: Real browser regressions pass on both preview routes at 320px, covering loading/empty/error/disabled controls and master/detail Back focus restoration.
