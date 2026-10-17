# src/marketing/faq-browser.tsx

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

FAQ surface, two exports. `FaqBrowser` is the searchable accordion used by
`/faq` (`app/faq/page.tsx`); `FaqWidget` is the floating launcher rendered
by `site-header.tsx` — opens the same browser inside a bottom-right
`<dialog>` panel.

## What It Does

- `FaqBrowser`: `filterFaqItems(siteConfig.faq, query)` search + count
  (`role="status"`), exclusive accordion via shared `name` on `<details>`;
  `animateAnswer` WAAPI height-fades the answer on `onToggle` (duration
  through `motionDuration`, so reduced-motion collapses it).
- `FaqWidget`: `showModal()` dialog — Esc (`onKeyDownCapture` +
  `onCancel`), backdrop click (`target === currentTarget`), and X all run
  the WAAPI close animation before `dialog.close()`; `restore` returns
  body scroll (`overflow` stash) and trigger focus. Open/close animate
  `data-faq-panel` (translate+scale+blur), `animation.current` cancels
  overlap and `finish()`es instantly under reduced motion.
- `<noscript>` hides the launcher — `/faq` remains the no-JS path.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-27 | Mirror created; dialog backdrop now transparent — no visible dim, modal semantics unchanged | Devin |
