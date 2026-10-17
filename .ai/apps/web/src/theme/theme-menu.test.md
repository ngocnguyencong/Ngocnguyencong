# src/theme/theme-menu.test.tsx

jsdom tests: the trigger shows the current pack name/aria-label from
`documentElement[data-theme]`; opening the details and clicking "Paper"
applies it through `applyTheme` (`data-theme`, `supastack-theme`
localStorage + cookie); a MutationObserver keeps the label in sync when the
pack changes elsewhere (`await act(async () => {})` flushes observer
delivery). `matchMedia` is stubbed to reduced-motion so
`runThemeTransition` applies synchronously (jsdom has no
`startViewTransition` anyway).
