# app-chrome.contract.test.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Contract tests for workspace chrome markup, localized labels, Lucide navigation
glyphs, and CSS hooks across desktop, narrow-screen, focused, and no-JavaScript
shell variants.

## Open Threads / Resume Context

The shell contract also verifies that the reference console shells use the
shared responsive frame and that navigation links/actions remain present in
the drawer source. A dedicated block pins the "AI task" nav item to `/ai`
(`#production-task` must not return as its target). The obsolete artwork hover assertion is replaced by
rendered default-name and caller-provided image contracts. Use an explicit
non-null props type in `createElement` for `AppBrand`'s optional argument;
React's overload inference otherwise rejects valid caller props.

## Important Notes / NEVER Change

- Keep these tests focused on stable contracts, not generated CSS-module hashes.
- Check actual locale-aware href bindings, rather than matching literal hrefs in comments.
- Default demo chrome must render only the app name, with no image or SVG artwork.
- Explicit custom workspace images and localized home links remain supported.
- The server markup stays navigable at narrow widths until the client drawer is
  ready; modal close returns focus through the shared Sheet primitive.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | Pin "AI task" nav href to `/ai` (no `#production-task` route target) | Devin |
| 2026-10-04 | Replace obsolete artwork preservation coverage with neutral chrome contracts | Codex |
