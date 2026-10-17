# apps/web/src/theme/presets.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Visitor UI preset axes painted on `<html>` — catalogs, storage/cookie
keys, resolvers, `apply*` persist fns, and the FOUC boot fragment
composed into `theme-boot.ts` via `uiPresetBootFragment()`.

## Axes

| Axis | Attribute | Ids | Default |
| --- | --- | --- | --- |
| Density | `data-density` | comfortable, compact | comfortable |
| Radius | `data-radius` | soft, sharp, round | soft |
| Font | `data-font` | editorial, geometric, monospace | editorial |
| Layout | `data-layout` | sidebar, topnav, focused, collapsible | sidebar |
| Toast style | `data-toast-style` | solid, soft, outline | solid |

## Important Notes

- The boot fragment accepts a whole-style fallback for every preset axis;
  valid saved visitor choices still take priority. Standalone callers retain
  the preset constants as fallbacks.
- Every axis triples as storage key + cookie name + `<html>` attribute;
  `persistAttribute` writes all three.
- CSS hooks for density/radius/font/layout live in `app/app-theme.css`
  (`html[data-x] .app-theme`). **Exception:** `data-toast-style` hooks
  live in `src/toast.module.css` because `<Toaster>` mounts at body
  level outside `.app-theme` — the attribute is global chrome.
- `uiPresetBootFragment()` serializes every catalog id + default into
  the boot script — keep it in sync when adding an axis.
- Outline toast copy describes its page fill, matching the legible opaque card.
- The `collapsible` layout keeps a browser-local expanded/collapsed sidebar
  preference under `supastack-sidebar-collapsed`; the shell defaults to expanded
  if storage is unavailable or the stored value is invalid.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Added `data-toast-style` axis (solid/soft/outline) + boot fragment | Devin |
