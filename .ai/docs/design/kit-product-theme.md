# docs/design/kit-product-theme.md

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Buyer-facing guide to Supastack theme files, style axes, block composition, and customization examples.

## Important Notes

- `DEFAULT_STYLE_ID` selects all six startup axes from one line. Marketing
  inherits by default; `MARKETING_THEME_MODE="locked"` or a pack ID opts into
  an independent marketing palette. Explicit saved visitor choices win.
  Product builders copy blocks and supply their own content.

## What It Does

- Example 6 shows how to copy the complete `TestimonialGrid` section, provide approved customer content, ratings, avatar slots, and localized copy. It explains that inherit mode follows density, radius, and font alongside the color pack.
