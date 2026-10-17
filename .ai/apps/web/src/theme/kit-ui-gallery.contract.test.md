# theme/kit-ui-gallery.contract.test.ts

> Last updated: 2026-09-20 | Protection: NORMAL

## Purpose

Source-level contract test for the Kit UI gallery: asserts the appearance
settings section mounts `ThemePicker` + `KitUiGallery`, the gallery keeps its
section wiring, and the default control styles (`.select`, radio, `.toggle`)
exist in `app-theme.css` with matching demos in the gallery.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-20 | Added default select/radio/toggle assertions | Devin |

## 2026-10-06
Locale props and shared Select replace literal English/native-popup wiring. Keep appearance mounting and radio/toggle previews.
