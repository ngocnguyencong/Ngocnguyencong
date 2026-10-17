# apps/web/src/theme/contrast.test.ts

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Computes color contrast for declared web theme token pairs.

## Coverage

- Measure actual WCAG ratios for primary/muted/content text against page,
  section, and raised surfaces; accent ink against accent and hover; button
  text against button; and focus/control borders against page and raised
  surfaces.
- Keep checks data-driven over every light and dark theme pack.

## Open Threads / Resume Context

- **Status:** implemented locally
- **Intent:** replace direction-only luminance checks with explicit pair ratios.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-06 | Add measured WCAG pair coverage across theme packs | Codex |

All 21 packs are checked at 4.5:1 for normal text, accent/button labels, and solid/soft status text; focus/control indicators require 3:1. This is declared-token coverage, not a complete rendered accessibility certification.

Check colored accent text against all content surfaces and the actual 12/16% selected/tinted backgrounds. Action fill and readable accent text require separate roles, especially for Paper.
