# app/theme.css

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Defines marketing surface structural tokens and an optional locked black palette.

## What It Does

- Inherit-mode marketing wrappers follow visitor color packs and the density, radius, and font axes from `STYLE_CATALOG`. The app layout axis controls app chrome only.

## Important Notes / NEVER Change

- Default marketing surfaces inherit the configured style through
  `[data-marketing-theme="inherit"]`. Explicit `[data-theme]` pins a pack;
  `MARKETING_THEME_MODE="locked"` deliberately selects the black override.

## Important Notes

- Keep the locked homepage and explicitly pinned marketing packs independent of visitor presets. `/kit-blocks` uses inherit mode to preview copyable marketing blocks under selected styles.
