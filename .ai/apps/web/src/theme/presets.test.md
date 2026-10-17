# apps/web/src/theme/presets.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Unit tests for `theme/presets.ts`.

## Coverage

- Default ids + catalog membership for all five axes (density, radius,
  font, layout, toast style), including the collapsible layout.
- Resolver fallbacks for unknown/null values per axis.
- Every preset entry ships non-empty name + description (Settings copy).
- `uiPresetBootFragment()` contains every `data-*` attribute, every
  catalog id, and every default.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Added `data-toast-style` axis coverage | Devin |
