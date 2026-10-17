# apps/web/src/theme/theme-transition.test.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Unit tests for `theme/theme-transition.ts` (`runThemeTransition`).

## Coverage

- Fallbacks call `apply()` synchronously exactly once: SSR (no `document`),
  missing `document.startViewTransition`, missing origin, and
  `prefers-reduced-motion`.
- With the API present, `apply` runs inside the `startViewTransition`
  update callback (not before it), and once `ready` resolves
  `documentElement.animate` receives a `clip-path` circle keyframe pair on
  `::view-transition-new(root)` — 550ms, `cubic-bezier(0.16, 1, 0.3, 1)`,
  farthest-corner radius computed against a stubbed 1024×768 viewport.
- Rejected `ready`/`finished`/`updateCallbackDone` are swallowed — no
  unhandled rejections, no `animate` call.
- Browser globals are stubbed per test with `vi.stubGlobal` (`document`,
  `matchMedia`, `innerWidth`/`innerHeight`) — node env, no jsdom.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Initial coverage | Devin |
