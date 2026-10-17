# tests/e2e/application-theme.spec.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Chromium coverage for the theme system: homepage identity on narrow
screens, auth chrome, premade style packs, Obsidian marketing lock vs
product packs, density/radius/font presets, and the narrow-shell
ThemePicker flow.

## Important Notes

- ThemePicker has two radiogroups ("Corner radius", "Toast style") that
  both contain a "Soft" option — scope via
  `getByRole("radiogroup", { name: "Corner radius" })` when picking radius.
- Radio names need `exact: true` where a longer label could collide
  (e.g. "Paper", "Obsidian").
- The narrow-shell test ends with a controlled-radio retry:
  `expect(async () => { check(); toHaveAttribute(data-theme, {timeout:1s}) }).toPass(15s)`
  — a click landing before hydration is silently reconciled back, so the
  whole interaction+outcome retries through public API. Do NOT reintroduce
  `__reactProps$`/`networkidle` probes (React internals / never settles
  under the dev HMR websocket).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Scoped "Soft" to Corner radius group; hydration-safe Paper retry via toPass | Devin |
