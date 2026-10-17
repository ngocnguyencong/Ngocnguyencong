# resources.module.css

> Last updated: 2026-09-21 | Protection: normal

## Purpose

Styles for the resources surfaces — blog cards/article, `/docs` shell
(`docsTop`, `docTabs`, `docsGrid`, `sidebar`), guide content (`prose`,
`docHeader`, `toc`), the search palette, and the mobile docs disclosure.

## Notes

- Docs nav groups are collapsible `<details>`: `.navGroup summary` is the
  folder row (hover `var(--raised)` bg, `::-webkit-details-marker` hidden),
  `.groupChevron` rotates 90° when `[open]`, and `.navItems` carries the
  left border rail with rounded link pills (`:hover` and `[aria-current]`
  get `var(--raised)`).
- `data-state="closing"` on a `<details>` pins the chevron mid-close —
  written by `DocsMotion` in `docs-tools.tsx`.
- `.mobileSidebar summary` mirrors the same hover/marker/chevron treatment
  under `@media (max-width: 640px)`.
- `prefers-reduced-motion` strips nav/summary/chevron transitions.
- Density pass: `.navItems a` is `min-height:30px` / 3px padding /
  `0.8125rem` (removed from the blanket 44px rule — `.filters`/`.toc` keep
  it); hover transitions are 100ms; `.navItems a[aria-current]::before`
  paints a 2px `--text` segment over the left rail (`left:-9px`), with a
  fainter `--border-strong` tick on `:hover`.

- `.tableWrap` (2026-09-23) styles section data tables: bordered
  `overflow-x:auto` region (focusable via `tabindex`), `thead` on
  `var(--raised)`, row `th[scope="row"]` in `--text`, body cells in
  `--content-text`, `.accentCell` = `--accent` text + 7% accent wash.
  `table` carries `min-width: 34rem` and row headers `min-width: 6rem` —
  narrow screens scroll the region horizontally instead of crushing the
  label column into per-character wrapping (verified at 320px).

## Change History

| Date       | Change                                                                 | Author |
| ---------- | ---------------------------------------------------------------------- | ------ |
| 2026-09-23 | `.tableWrap` + `.accentCell` table styles for `Section.table` | Devin  |
| 2026-09-21 | Nav density + lit rail segment on active/hover; 100ms hover transitions | Devin  |
| 2026-09-21 | Collapsible-folder nav styles: summary hover bg, chevrons, `.navItems` rail, mobile + reduced-motion states | Devin  |
2026-09-23 — `.tableWrap:focus-visible` accent outline added (keyboard focus on the scroll region). — Devin
2026-10-01 user-authorized refinement: render setupSentence as a prose continuation separate from topic prev/next; three local-setup tutorials are first and marked by brand-colored lucide Zap. Preserve the existing page shell and animation.
2026-10-01: setupFlow is a readable inline sentence using existing content/accent tokens; its link is underlined and server-rendered. quickstartIcon uses brand-colored lucide Zap without new motion.

## 2026-10-06 foundation integration
Reuse shared feedback/disclosure timings and preserve native controls, essential no-JavaScript reading, and reduced-motion state cues.

2026-10-06: Colored foregrounds use `--accent-text` with an accent fallback. Keep action fills, borders, and control indicators on `--accent`; light-palette text must meet 4.5:1 on plain and tinted surfaces.

2026-10-12 navigation repair plan: Remove the resource wrapper current-page header underline. Keep prose link underlines and aria-current semantics; active nav remains distinguished by text color.

2026-10-12 complete: Removed only the header current-page underline override; retained resource prose and document navigation styling. Desktop/mobile current page computed text-decoration-line:none verified, links navigate successfully.
