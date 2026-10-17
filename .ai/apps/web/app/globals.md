# app/globals.css

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Global stylesheet for the app surface: auth/task forms, buttons, cards,
plan catalog, quiet notes, and shared focus-visible rings.

## Notes

- `.auth-back` (added 2026-09-23): quiet inline back affordance inside
  auth steps — `appearance:none`, no border/background, arrow + label via
  `inline-flex`, `justify-self:start` inside the `.auth-form` grid. Color
  + hover live in `app-theme.css`; global `button` rules supply cursor +
  focus-visible.
- `.seat-stepper` (added 2026-09-20): flex row for the `/billing` Seats
  control — `.seat-step` square-ish secondary buttons (44px), `.seat-count`
  bordered text input (tabular-nums, centered). Same token set as
  `.auth-form input`.
- `::view-transition-old/new(root)` (added 2026-09-23): root snapshot rules
  for the "spread of color" theme reveal (`src/theme/theme-transition.ts`) —
  default animations off, `mix-blend-mode:normal`, new snapshot stacked on
  top via `z-index` so the JS clip-path circle is the only motion. Lives
  here (not app-theme.css/theme.css) because view-transition pseudos are
  document-level and can't be scoped under `.app-theme`/`.marketing-theme`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-23 | `::view-transition-old/new(root)` rules for the theme-switch circle reveal | Devin |
| 2026-09-23 | `.auth-back` — inline arrow-line back control for auth steps (replaces the full-width `.button` back button) | Devin |
| 2026-09-21 | `overscroll-behavior:none` on html/body (kills rubber-band/stretch past page ends); site-wide thin theme-tinted scrollbars (`scrollbar-width/color` + `::-webkit-scrollbar` via `color-mix(--text)`) | Devin |
| 2026-09-20 | Added `.seat-stepper` rules for the editable billing Seats stepper | Devin |
