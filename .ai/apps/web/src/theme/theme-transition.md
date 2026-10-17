# apps/web/src/theme/theme-transition.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`runThemeTransition(apply, origin?)` — the "spread of color" theme-switch
animation. Wraps `document.startViewTransition`: `apply` mutates the DOM
synchronously inside the update callback, then once `ready` resolves it
animates a `clip-path` `circle()` on `::view-transition-new(root)` —
expanding from `origin` (viewport x/y) out to the farthest-corner radius,
550ms on `cubic-bezier(0.16, 1, 0.3, 1)` (the repo `--ease` curve).

## Important Notes

- Fallbacks all call `apply()` synchronously (instant switch): SSR (no
  `document`), missing `origin`, no `document.startViewTransition`,
  `prefers-reduced-motion`, or `startViewTransition` throwing before its
  async update callback runs.
- Rejected `ready`/`finished`/`updateCallbackDone` promises are swallowed —
  skipped or superseded transitions must not surface unhandled rejections.
- Companion CSS lives in `app/globals.css`:
  `::view-transition-old/new(root)` get `animation:none` +
  `mix-blend-mode:normal`, and the new snapshot stacks on top via
  `z-index` so the clip reveal replaces the default crossfade. globals.css
  (not app-theme.css/theme.css) because view-transition pseudos are
  document-level — they can't be scoped under `.app-theme`/`.marketing-theme`.
- Wired only for color-relevant picks in `theme-picker.tsx` — color packs
  and design styles; density/radius/font/layout/toast-style axes stay
  instant on purpose.
- Origins: `onPointerDown` on the option label captures real click
  coordinates (change events carry none); keyboard/virtual activation
  falls back to the control's rect center.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Initial — circular clip-path theme reveal helper | Devin |
