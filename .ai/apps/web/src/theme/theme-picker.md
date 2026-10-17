# apps/web/src/theme/theme-picker.tsx

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Settings → Appearance control surface: Design style (STYLE_CATALOG
bundles), Premade theme (color packs), then one `PresetRadiogroup`
per preset axis — density, radius, font, layout, and toast style.

## Important Notes

- Initial axis state is read post-hydration from `<html>` `data-*`
  attributes (stamped by the boot script) — never from localStorage.
- Picking a design style re-reads ALL axis states after `applyStyle`
  (a style sets every axis; a manual axis pick afterwards flips the
  style label to a custom mix via `currentStyleId()`).
- The toast-style fieldset includes a "Preview toast" button calling
  `toast.success(...)` so the pick is visible live — `<Toaster>` is
  mounted globally in `app/layout.tsx`.
- Color pack + design style picks route through `runThemeTransition`
  (`theme-transition.ts`) — a circular clip-path reveal from the click
  point. The origin is captured on the label's `onPointerDown` (change
  events carry no pointer coords; `forId` guards stale origins) and
  keyboard/virtual picks fall back to the control's rect center. The
  whole existing onChange body (apply + state re-sync) runs inside the
  view-transition update callback. Preset axes are deliberately NOT
  transitioned.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-15 | User picks call `markAppearanceChanged()` (stamps `supastack-appearance-updated-at` + fires the sync event); a `supastack:appearance-applied` listener re-reads the DOM so the open picker reflects a server-applied snapshot | Devin |
| 2026-09-23 | Spread-of-color reveal via `runThemeTransition` on pack + style radios | Devin |
| 2026-09-22 | Added Toast style radiogroup + live preview button | Devin |

## UI foundation implementation (2026-10-06)

Shared accessible Select/Popover/Dialog behavior is integrated where applicable; shared chrome and appearance labels are localized. Workspace scope, server-authoritative actions, neutral sample content, and native form/essential reading fallbacks are preserved. Behavioral verification covers the shared primitives; live authenticated/provider flows remain outside local acceptance.
