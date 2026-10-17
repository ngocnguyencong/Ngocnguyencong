# faq-browser.module.css

> Last updated: 2026-09-27 | Protection: normal

## Purpose

Styles for `faq-browser.tsx`: fixed `.launcher` pill, the `.dialog` shell +
`.panel` card, search row, accordion `details`/`summary` rows, `.fullPage`
link, and `/faq`'s `.page` column.

## Notes

- `.dialog::backdrop` is `background: transparent` (2026-09-27) — the rule
  must stay declared because the UA default `::backdrop` still applies a
  ~10% black tint. The transparent backdrop still covers the viewport, so
  outside clicks reach the dialog and light-dismiss keeps working.
- `.dialog` is bottom-right anchored (`inset: auto 20px 20px auto`),
  `background: transparent`, `overflow: visible`; the visual card is
  `.panel` (border, `--raised`, 16px radius, black-mix shadow, own scroll
  + styled thin scrollbars).
- `.answers summary` hides the native marker; `.plusIcon` rotates 45° on
  `[open]` (transition stripped under reduced motion).
- `.count` uses `!important` margin to beat the global `p` cap.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-27 | `.dialog::backdrop` → transparent; opening the FAQ widget no longer dims the page | Devin |

2026-10-06: Colored foregrounds use `--accent-text` with an accent fallback. Keep action fills, borders, and control indicators on `--accent`; light-palette text must meet 4.5:1 on plain and tinted surfaces.
