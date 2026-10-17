# utility-page.module.css

> Last updated: 2026-09-27 | Protection: normal

## Purpose

Shared marketing utility-page styles: centered intro, prose, `.panel` form
cards, `.form` inputs/button, status notice. Used by `legal-page.tsx`
(terms/privacy) and `contact-page.tsx`.

## Notes

- Token-only: `--max`, `--gutter`, `--header-h`, `--border`,
  `--border-strong`, `--raised`, `--radius-card`, `--radius-control`,
  `--btn`, `--btn-text`, `--accent`, `--ease`.
- `.intro h1` needs `margin: 0 auto` — global `h1 { max-width: 12ch }`
  otherwise pins the capped title box to the left edge. Since 2026-09-26
  the ResourceShell `.home` margin reset lives inside `:where()` (zero
  specificity), so these auto margins can no longer lose the cascade to
  stylesheet order — guarded by `utility-page.contract.test.ts`.
- `.forms` is a 2-column grid (`3fr/2fr`, contact left, newsletter right)
  collapsing to one column ≤720px; `.prose` keeps its own 42rem column.
- `.prose section ul`/`li`/`li::marker` style the license page's bullet lists
  (muted body text, accent markers) — same type scale as `.prose section p`.
- `.form button` carries `border-radius: var(--radius-control)`.
- Reduced-motion strips `.form` input/button transitions.

## Change History

| Date       | Change                                                              | Author |
| ---------- | ------------------------------------------------------------------- | ------ |
| 2026-09-27 | Added `.prose section ul`/`li`/`::marker` rules for the license page's bullet lists | Devin |
| 2026-09-26 | Added `utility-page.contract.test.ts` covering the zero-specificity `.home` margin reset + intro centering | Devin |
| 2026-09-21 | Redesign: centered intro h1, 2-col `.forms`, section hairlines, muted label captions, focus rings, rounded buttons, bordered `.status` | Devin  |

2026-10-06: Colored foregrounds use `--accent-text` with an accent fallback. Keep action fills, borders, and control indicators on `--accent`; light-palette text must meet 4.5:1 on plain and tinted surfaces.
