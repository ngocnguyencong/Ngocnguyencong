# src/usage-settings.module.css

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Token-only styles for `usage-settings.tsx`: card layout, meter
track/fill rows (`ok`/`warning`/`danger` tones off `--warning`/`--danger`),
cap/budget form rows, and the quiet metadata text.

## Important Notes

- Uses design tokens only (`--raised`, `--border`, `--muted`, `--accent`,
  `--warning`, `--danger`, spacing/radius tokens) — no hex literals, so
  every color pack repaints the panel.
- The meter fill width is set inline from the percent; tone classes here
  only swap the fill color.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
| 2026-10-16 | capForm → manageRow/field/actions: stacked labels, 12rem field width (constrained wrapper — global `.app-theme` input rule wins on input itself), inline action row | Devin |
